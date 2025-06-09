import { MongoClient, Db } from "mongodb";
import { google, youtube_v3 } from "googleapis";
import { createHash } from "crypto";

export interface FindConsistentOutlierChannelsOptions {
  query: string;
  channelAge: "NEW" | "ESTABLISHED";
  consistencyLevel: "MODERATE" | "HIGH";
  outlierMagnitude: "STANDARD" | "STRONG";
  videoCategoryId?: string;
  regionCode?: string;
  maxResults: number;
}

interface SearchCache {
  _id?: string;
  searchParamsHash: string;
  searchParams: youtube_v3.Params$Resource$Search$List;
  results: any[];
  createdAt: Date;
  expiresAt: Date;
}

interface ChannelCache {
  _id: string; // Channel ID
  channelTitle: string;
  createdAt: Date;
  status:
    | "candidate"
    | "archived_too_old"
    | "archived_low_potential"
    | "analyzed_low_consistency"
    | "analyzed_promising";
  latestStats: {
    fetchedAt: Date;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
  };
  latestAnalysis?: {
    analyzedAt: Date;
    consistencyPercentage: number;
    sourceVideoCount: number;
    outlierMagnitudeUsed: "STANDARD" | "STRONG";
  };
  analysisHistory: Array<{
    analyzedAt: Date;
    consistencyPercentage: number;
    subscriberCountAtAnalysis: number;
    videoCountAtAnalysis: number;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
  }>;
}

export class NicheAnalyzer {
  private youtube: youtube_v3.Youtube;
  private mongoClient: MongoClient;
  private db: Db | null = null;
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly DATABASE_NAME = "youtube_niche_analysis";
  private readonly SEARCH_CACHE_COLLECTION = "search_cache";
  private readonly CHANNELS_CACHE_COLLECTION = "channels_cache";
  private readonly CACHE_TTL_HOURS = 24;
  private readonly STALENESS_DAYS_NEW = 14;
  private readonly STALENESS_DAYS_ESTABLISHED = 45;
  private readonly MIN_AVG_VIEWS_THRESHOLD = 1000;

  constructor() {
    // Initialize YouTube API client
    this.youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    });

    // Initialize MongoDB client
    const connectionString = process.env.MDB_MCP_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error(
        "MDB_MCP_CONNECTION_STRING environment variable is required"
      );
    }

    this.mongoClient = new MongoClient(connectionString);
  }

  async connect(): Promise<void> {
    try {
      await this.mongoClient.connect();
      this.db = this.mongoClient.db(this.DATABASE_NAME);
    } catch (error: any) {
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.mongoClient.close();
      this.db = null;
    } catch (error: any) {
      throw new Error(`Failed to disconnect from MongoDB: ${error.message}`);
    }
  }

  private ensureConnected(): void {
    if (!this.db) {
      throw new Error(
        "MongoDB connection not established. Call connect() first."
      );
    }
  }

  private calculateChannelAgePublishedAfter(
    channelAge: "NEW" | "ESTABLISHED"
  ): string {
    const now = new Date();
    const monthsToSubtract = channelAge === "NEW" ? 6 : 24;
    const millisecondsToSubtract = monthsToSubtract * 30 * 24 * 60 * 60 * 1000;
    const targetTime = new Date(now.getTime() - millisecondsToSubtract);
    return targetTime.toISOString();
  }

  private getOutlierMultiplier(
    outlierMagnitude: "STANDARD" | "STRONG"
  ): number {
    return outlierMagnitude === "STANDARD" ? 1 : 3;
  }

  private getConsistencyThreshold(
    consistencyLevel: "MODERATE" | "HIGH"
  ): number {
    return consistencyLevel === "MODERATE" ? 30 : 50;
  }

  private applyStalnessHeuristic(
    channel: ChannelCache,
    channelAge: "NEW" | "ESTABLISHED"
  ): boolean {
    if (!channel.latestAnalysis) {
      return true; // No analysis exists, so it's stale
    }

    const now = new Date();
    const analysisAge =
      now.getTime() - channel.latestAnalysis.analyzedAt.getTime();
    const staleDays =
      channelAge === "NEW"
        ? this.STALENESS_DAYS_NEW
        : this.STALENESS_DAYS_ESTABLISHED;
    const staleThreshold = staleDays * 24 * 60 * 60 * 1000;

    return analysisAge > staleThreshold;
  }

  private calculateDerivedMetrics(channel: any): {
    historicalAvgViewsPerVideo: number;
    libraryEngagementRatio: number;
  } {
    const avgViews =
      channel.statistics?.videoCount > 0
        ? parseInt(channel.statistics.viewCount) /
          parseInt(channel.statistics.videoCount)
        : 0;

    const engagementRatio =
      channel.statistics?.subscriberCount > 0
        ? parseInt(channel.statistics.viewCount) /
          parseInt(channel.statistics.subscriberCount)
        : 0;

    return {
      historicalAvgViewsPerVideo: avgViews,
      libraryEngagementRatio: engagementRatio,
    };
  }

  private async updateChannelCache(
    channelId: string,
    updates: Partial<ChannelCache>
  ): Promise<void> {
    try {
      const collection = this.db!.collection(this.CHANNELS_CACHE_COLLECTION);
      await collection.updateOne(
        { _id: channelId } as any,
        { $set: updates },
        { upsert: true }
      );
    } catch (error: any) {
      console.error(
        `Failed to update channel cache for ${channelId}: ${error.message}`
      );
      throw error;
    }
  }

  private async batchFetchChannelStatistics(
    channelIds: string[]
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    if (channelIds.length === 0) {
      return results;
    }

    try {
      // YouTube API allows up to 50 channel IDs per request
      const batchSize = 50;
      for (let i = 0; i < channelIds.length; i += batchSize) {
        const batch = channelIds.slice(i, i + batchSize);

        const response = await this.youtube.channels.list({
          part: ["snippet", "statistics"],
          id: batch,
        });

        if (response.data.items) {
          for (const channel of response.data.items) {
            if (channel.id) {
              results.set(channel.id, channel);
            }
          }
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to fetch channel statistics: ${error.message}`);
    }

    return results;
  }

  private calculateTotalCost(
    candidateCount: number,
    prospectCount: number
  ): number {
    const phase1Cost = 100; // Initial search
    const phase2Cost = Math.ceil(candidateCount / 50); // ~1 credit per 50 channels
    const phase3Cost = prospectCount * 101; // ~101 credits per prospect
    return phase1Cost + phase2Cost + phase3Cost;
  }

  private generateSearchParamsHash(
    searchParams: youtube_v3.Params$Resource$Search$List
  ): string {
    // Create a consistent string representation of search parameters
    const paramsString = JSON.stringify(
      searchParams,
      Object.keys(searchParams).sort()
    );
    return createHash("sha256").update(paramsString).digest("hex");
  }

  private async getCachedSearchResults(
    searchParams: youtube_v3.Params$Resource$Search$List
  ): Promise<any[] | null> {
    try {
      const collection = this.db!.collection(this.SEARCH_CACHE_COLLECTION);
      const searchParamsHash = this.generateSearchParamsHash(searchParams);

      const cachedResult = (await collection.findOne({
        searchParamsHash,
        expiresAt: { $gt: new Date() },
      })) as SearchCache | null;

      if (cachedResult) {
        return cachedResult.results;
      }

      return null;
    } catch (error: any) {
      // Log error but don't throw - fallback to YouTube API
      console.error(`Cache retrieval failed: ${error.message}`);
      return null;
    }
  }

  private async storeCachedSearchResults(
    searchParams: youtube_v3.Params$Resource$Search$List,
    results: any[]
  ): Promise<void> {
    try {
      const collection = this.db!.collection(this.SEARCH_CACHE_COLLECTION);
      const searchParamsHash = this.generateSearchParamsHash(searchParams);
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + this.CACHE_TTL_HOURS * 60 * 60 * 1000
      );

      const cacheDocument: SearchCache = {
        searchParamsHash,
        searchParams,
        results,
        createdAt: now,
        expiresAt,
      };

      await collection.updateOne(
        { searchParamsHash },
        { $set: cacheDocument },
        { upsert: true }
      );
    } catch (error: any) {
      // Log error but don't throw - caching failure shouldn't break the main functionality
      console.error(`Cache storage failed: ${error.message}`);
    }
  }

  /**
   * Phase 1: Initial Candidate Search (Cost: 100 credits)
   * Performs YouTube search and extracts unique channel IDs from video results
   */
  private async executeInitialCandidateSearch(
    options: FindConsistentOutlierChannelsOptions
  ): Promise<string[]> {
    try {
      // Calculate publishedAfter based on channelAge
      const publishedAfter = this.calculateChannelAgePublishedAfter(
        options.channelAge
      );

      // Build search parameters
      const searchParams: youtube_v3.Params$Resource$Search$List = {
        q: options.query,
        publishedAfter: publishedAfter,
        part: ["snippet"],
        type: ["video"],
        order: "relevance",
        maxResults: this.MAX_RESULTS_PER_PAGE,
      };

      // Add optional parameters if provided
      if (options.regionCode) {
        searchParams.regionCode = options.regionCode;
      }

      if (options.videoCategoryId) {
        searchParams.videoCategoryId = options.videoCategoryId;
      }

      // Check cache first
      let results = await this.getCachedSearchResults(searchParams);

      if (!results) {
        // Perform the search from YouTube API
        const initialSearchResults = await this.youtube.search.list(
          searchParams
        );
        results = initialSearchResults.data.items || [];

        // Store results in cache for future use
        await this.storeCachedSearchResults(searchParams, results);
      }

      // Extract unique channel IDs from video results
      const channelIds = new Set<string>();
      for (const video of results) {
        if (video.snippet?.channelId) {
          channelIds.add(video.snippet.channelId);
        }
      }

      return Array.from(channelIds);
    } catch (error: any) {
      throw new Error(`Phase 1 failed: ${error.message}`);
    }
  }

  /**
   * Phase 2: Channel Pre-Filtering & Cache Logic (Cost: ~1 credit per 50 new channels)
   * Queries cache, fetches missing stats, applies age and potential filters
   */
  private async executeChannelPreFiltering(
    channelIds: string[],
    options: FindConsistentOutlierChannelsOptions
  ): Promise<string[]> {
    try {
      const collection = this.db!.collection(this.CHANNELS_CACHE_COLLECTION);
      const prospectsForPhase3: string[] = [];
      const needsStatsFetch: string[] = [];

      // Step 1: Query cache for existing channels
      const cachedChannels = await collection
        .find({ _id: { $in: channelIds } } as any)
        .toArray();

      const cachedChannelMap = new Map<string, ChannelCache>();
      for (const channel of cachedChannels) {
        cachedChannelMap.set(
          channel._id as unknown as string,
          channel as unknown as ChannelCache
        );
      }

      // Step 2: Categorize channels and identify those needing stats fetch
      for (const channelId of channelIds) {
        const cachedChannel = cachedChannelMap.get(channelId);

        if (!cachedChannel) {
          // Cache miss - need to fetch stats
          needsStatsFetch.push(channelId);
        } else {
          // Cache hit - check staleness
          const isStale = this.applyStalnessHeuristic(
            cachedChannel,
            options.channelAge
          );
          if (isStale) {
            needsStatsFetch.push(channelId);
          }
        }
      }

      // Step 3: Batch fetch missing channel statistics
      const freshChannelStats = await this.batchFetchChannelStatistics(
        needsStatsFetch
      );

      // Step 4: Update cache with new stats and perform pre-filtering
      for (const channelId of channelIds) {
        let channelData = cachedChannelMap.get(channelId);
        const freshStats = freshChannelStats.get(channelId);

        // Update with fresh stats if available
        if (freshStats) {
          const now = new Date();
          const channelCreatedAt = freshStats.snippet?.publishedAt
            ? new Date(freshStats.snippet.publishedAt)
            : now;

          const updatedChannel: Partial<ChannelCache> = {
            _id: channelId,
            channelTitle: freshStats.snippet?.title || "Unknown Channel",
            createdAt: channelCreatedAt,
            status: channelData?.status || "candidate",
            latestStats: {
              fetchedAt: now,
              subscriberCount: parseInt(
                freshStats.statistics?.subscriberCount || "0"
              ),
              videoCount: parseInt(freshStats.statistics?.videoCount || "0"),
              viewCount: parseInt(freshStats.statistics?.viewCount || "0"),
            },
            latestAnalysis: channelData?.latestAnalysis,
            analysisHistory: channelData?.analysisHistory || [],
          };

          await this.updateChannelCache(channelId, updatedChannel);
          channelData = updatedChannel as ChannelCache;
        }

        if (!channelData) {
          // Skip channels we couldn't fetch data for
          continue;
        }

        // Step 5: Apply age filtering
        const channelAge = this.calculateChannelAge(channelData.createdAt);
        const isValidAge = this.isValidChannelAge(
          channelAge,
          options.channelAge
        );

        if (!isValidAge) {
          await this.updateChannelCache(channelId, {
            status: "archived_too_old",
          });
          continue;
        }

        // Step 6: Apply potential filtering
        const metrics = this.calculateDerivedMetrics({
          statistics: channelData.latestStats,
        });
        const hasGoodPotential =
          metrics.historicalAvgViewsPerVideo >= this.MIN_AVG_VIEWS_THRESHOLD;

        if (!hasGoodPotential) {
          await this.updateChannelCache(channelId, {
            status: "archived_low_potential",
          });
          continue;
        }

        // Channel passed all filters - add to prospects
        prospectsForPhase3.push(channelId);
      }

      return prospectsForPhase3;
    } catch (error: any) {
      throw new Error(`Phase 2 failed: ${error.message}`);
    }
  }

  private calculateChannelAge(createdAt: Date): number {
    const now = new Date();
    const ageInMs = now.getTime() - createdAt.getTime();
    return ageInMs / (1000 * 60 * 60 * 24 * 30); // Age in months
  }

  private isValidChannelAge(
    ageInMonths: number,
    channelAge: "NEW" | "ESTABLISHED"
  ): boolean {
    if (channelAge === "NEW") {
      return ageInMonths <= 6;
    } else {
      return ageInMonths >= 6 && ageInMonths <= 24;
    }
  }

  /**
   * Phase 3: Deep Consistency Analysis (Cost: ~101 credits per new prospect)
   * Fetches top videos for each channel and calculates consistency percentages
   */
  private async executeDeepConsistencyAnalysis(
    prospects: string[],
    options: FindConsistentOutlierChannelsOptions
  ): Promise<
    Array<{
      channelData: ChannelCache;
      consistencyPercentage: number;
      outlierCount: number;
    }>
  > {
    try {
      const collection = this.db!.collection(this.CHANNELS_CACHE_COLLECTION);
      const promisingChannels: any[] = [];
      const publishedAfter = this.calculateChannelAgePublishedAfter(
        options.channelAge
      );
      const outlierMultiplier = this.getOutlierMultiplier(
        options.outlierMagnitude
      );
      const consistencyThreshold = this.getConsistencyThreshold(
        options.consistencyLevel
      );

      for (const channelId of prospects) {
        try {
          // Get current channel data from cache
          const channelData = (await collection.findOne({
            _id: channelId,
          } as any)) as ChannelCache | null;

          if (!channelData) {
            console.warn(
              `Channel ${channelId} not found in cache during Phase 3`
            );
            continue;
          }

          // Check for re-analysis trigger (significant subscriber growth)
          const shouldSkipAnalysis = await this.shouldSkipReAnalysis(
            channelData
          );
          if (shouldSkipAnalysis && channelData.latestAnalysis) {
            // Use existing analysis if subscriber growth is minimal
            const consistencyPercentage =
              channelData.latestAnalysis.consistencyPercentage;
            if (consistencyPercentage >= consistencyThreshold) {
              promisingChannels.push({
                channelData: channelData,
                consistencyPercentage: consistencyPercentage,
                outlierCount:
                  channelData.latestAnalysis.sourceVideoCount -
                  (channelData.latestAnalysis.consistencyPercentage / 100) *
                    channelData.latestAnalysis.sourceVideoCount, // This is a placeholder, needs to be derived from stored data or re-calculated if not stored. For now, assuming sourceVideoCount is total videos and consistency is based on non-outliers.
              });
            }
            continue;
          }

          // Fetch top recent videos for this channel (Cost: 100 credits)
          const topVideos = await this.fetchChannelTopVideos(
            channelId,
            publishedAfter
          );

          if (topVideos.length === 0) {
            console.warn(
              `No videos found for channel ${channelId} in the specified time window`
            );
            continue;
          }

          // Calculate consistency percentage
          const { consistencyPercentage, outlierCount } =
            this.calculateConsistencyPercentage(
              topVideos,
              channelData.latestStats.subscriberCount,
              outlierMultiplier
            );

          // Create new analysis record
          const now = new Date();
          const newAnalysis = {
            analyzedAt: now,
            consistencyPercentage,
            sourceVideoCount: topVideos.length,
            outlierMagnitudeUsed: options.outlierMagnitude,
          };

          // Create history entry with source data
          const historyEntry = {
            analyzedAt: now,
            consistencyPercentage,
            subscriberCountAtAnalysis: channelData.latestStats.subscriberCount,
            videoCountAtAnalysis: channelData.latestStats.videoCount,
            subscriberCount: channelData.latestStats.subscriberCount,
            videoCount: channelData.latestStats.videoCount,
            viewCount: channelData.latestStats.viewCount,
          };

          // Determine final status
          const finalStatus =
            consistencyPercentage >= consistencyThreshold
              ? "analyzed_promising"
              : "analyzed_low_consistency";

          // Update cache with analysis results
          await collection.updateOne({ _id: channelId } as any, {
            $set: {
              latestAnalysis: newAnalysis,
              status: finalStatus,
            },
            $push: {
              analysisHistory: historyEntry,
            } as any,
          });

          // Add to promising channels if it meets the threshold
          if (consistencyPercentage >= consistencyThreshold) {
            // We push the raw data needed for final formatting later
            promisingChannels.push({
              // Update the channel data with the new analysis before pushing
              channelData: {
                ...channelData,
                latestAnalysis: newAnalysis,
                status: finalStatus as ChannelCache["status"],
              },
              consistencyPercentage: consistencyPercentage,
              outlierCount: outlierCount, // <-- The crucial addition
            });
          }
        } catch (error: any) {
          console.error(
            `Failed to analyze channel ${channelId}: ${error.message}`
          );
          // Continue with other channels even if one fails
          continue;
        }
      }

      // Sort by consistency percentage (highest first)
      promisingChannels.sort(
        (a, b) => b.consistencyPercentage - a.consistencyPercentage
      );

      return promisingChannels;
    } catch (error: any) {
      throw new Error(`Phase 3 failed: ${error.message}`);
    }
  }

  private async shouldSkipReAnalysis(
    channelData: ChannelCache
  ): Promise<boolean> {
    if (!channelData.latestAnalysis || !channelData.analysisHistory.length) {
      return false; // No previous analysis, must analyze
    }

    // Find the subscriber count when the last analysis was done
    const lastAnalysis =
      channelData.analysisHistory[channelData.analysisHistory.length - 1];
    const previousSubscriberCount = lastAnalysis.subscriberCountAtAnalysis;
    const currentSubscriberCount = channelData.latestStats.subscriberCount;

    // If subscriber growth is less than 20%, skip re-analysis
    const growthPercentage =
      ((currentSubscriberCount - previousSubscriberCount) /
        previousSubscriberCount) *
      100;
    return growthPercentage < 20;
  }

  private async fetchChannelTopVideos(
    channelId: string,
    publishedAfter: string
  ): Promise<youtube_v3.Schema$Video[]> {
    try {
      // Step 1: Search for video IDs by viewCount
      const searchResponse = await this.youtube.search.list({
        channelId: channelId,
        part: ["snippet"],
        order: "viewCount",
        maxResults: 50,
        publishedAfter: publishedAfter,
        type: ["video"],
      });

      const videoIds =
        searchResponse.data.items
          ?.map((item) => item.id?.videoId)
          .filter((id): id is string => id !== undefined) || [];

      if (videoIds.length === 0) {
        return [];
      }

      // Step 2: Retrieve full video details including statistics for the fetched video IDs
      const videosResponse = await this.youtube.videos.list({
        part: ["statistics"],
        id: videoIds,
      });

      return videosResponse.data.items || [];
    } catch (error: any) {
      throw new Error(
        `Failed to fetch top videos for channel ${channelId}: ${error.message}`
      );
    }
  }

  private calculateConsistencyPercentage(
    videos: youtube_v3.Schema$Video[],
    subscriberCount: number,
    outlierMultiplier: number
  ): { consistencyPercentage: number; outlierCount: number } {
    if (videos.length === 0) {
      return { consistencyPercentage: 0, outlierCount: 0 };
    }

    let outlierCount = 0;
    const threshold = subscriberCount * outlierMultiplier;

    for (const video of videos) {
      const viewCount = parseInt(video.statistics?.viewCount || "0");
      if (viewCount > threshold) {
        outlierCount++;
      }
    }

    const consistencyPercentage = (outlierCount / videos.length) * 100;
    return { consistencyPercentage, outlierCount };
  }

  async findConsistentOutlierChannels({
    query,
    channelAge,
    consistencyLevel,
    outlierMagnitude,
    videoCategoryId,
    regionCode,
    maxResults,
  }: FindConsistentOutlierChannelsOptions) {
    this.ensureConnected();

    try {
      // Phase 1: Initial candidate search (100 credits)
      const candidateChannelIds = await this.executeInitialCandidateSearch({
        query,
        channelAge,
        consistencyLevel,
        outlierMagnitude,
        videoCategoryId,
        regionCode,
        maxResults,
      });

      // Phase 2: Pre-filtering & cache logic (~1 credit per 50 channels)
      const prospects = await this.executeChannelPreFiltering(
        candidateChannelIds,
        {
          query,
          channelAge,
          consistencyLevel,
          outlierMagnitude,
          videoCategoryId,
          regionCode,
          maxResults,
        }
      );

      // Phase 3: Deep consistency analysis (~101 credits per prospect)
      const analysisResults = await this.executeDeepConsistencyAnalysis(
        // Renamed for clarity
        prospects,
        {
          query,
          channelAge,
          consistencyLevel,
          outlierMagnitude,
          videoCategoryId,
          regionCode,
          maxResults,
        }
      );

      // Phase 4: Filter, Sort, Slice & Format (as per requirements)

      // The data is already filtered by consistency and sorted. Now we format and slice.
      const finalResults = analysisResults
        .slice(0, maxResults) // Apply maxResults limit
        .map((result) => {
          const now = new Date();
          const createdAt = new Date(result.channelData.createdAt);
          const ageInMillis = now.getTime() - createdAt.getTime();
          const ageInDays = Math.floor(ageInMillis / (1000 * 60 * 60 * 24)); // Calculate age in DAYS

          return {
            channelId: result.channelData._id,
            channelTitle: result.channelData.channelTitle,
            channelAgeDays: ageInDays,
            subscriberCount: result.channelData.latestStats.subscriberCount,
            videoCount: result.channelData.latestStats.videoCount,
            analysis: {
              consistencyPercentage: result.consistencyPercentage,
              outlierVideoCount: result.outlierCount,
            },
          };
        });

      // Construct the final return object exactly as specified
      return {
        status: "COMPLETED_SUCCESSFULLY", // Hardcoded for now. Will be dynamic after implementing quota handling.
        summary: {
          candidatesFound: candidateChannelIds.length,
          candidatesAnalyzed: prospects.length,
          apiCreditsUsed: this.calculateTotalCost(
            candidateChannelIds.length,
            prospects.length
          ),
        },
        results: finalResults,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to find consistent outlier channels: ${error.message}`
      );
    }
  }
}
