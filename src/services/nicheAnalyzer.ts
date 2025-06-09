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

export class NicheAnalyzer {
  private youtube: youtube_v3.Youtube;
  private mongoClient: MongoClient;
  private db: Db | null = null;
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly DATABASE_NAME = "youtube_niche_analysis";
  private readonly SEARCH_CACHE_COLLECTION = "search_cache";
  private readonly CACHE_TTL_HOURS = 24;

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
      // Calculate publishedAfter based on channelAge
      const publishedAfter = this.calculateChannelAgePublishedAfter(channelAge);

      // Build search parameters
      const searchParams: youtube_v3.Params$Resource$Search$List = {
        q: query,
        publishedAfter: publishedAfter,
        part: ["snippet"],
        type: ["video"],
        order: "relevance",
        maxResults: this.MAX_RESULTS_PER_PAGE,
      };

      // Add optional parameters if provided
      if (regionCode) {
        searchParams.regionCode = regionCode;
      }

      if (videoCategoryId) {
        searchParams.videoCategoryId = videoCategoryId;
      }

      // Check cache first
      const cachedResults = await this.getCachedSearchResults(searchParams);
      if (cachedResults) {
        return cachedResults;
      }

      // Perform the search from YouTube API
      const initialSearchResults = await this.youtube.search.list(searchParams);
      const results = initialSearchResults.data.items || [];

      // Store results in cache for future use
      await this.storeCachedSearchResults(searchParams, results);

      // Return raw search results for now
      // TODO: Implement outlier analysis logic based on consistencyLevel and outlierMagnitude
      // TODO: Store/retrieve channel statistics from MongoDB to avoid recalculation
      return results;
    } catch (error: any) {
      throw new Error(
        `Failed to find consistent outlier channels: ${error.message}`
      );
    }
  }

  // Future method for storing channel statistics in MongoDB
  async storeChannelStatistics(
    channelId: string,
    statistics: any
  ): Promise<void> {
    this.ensureConnected();

    try {
      const collection = this.db!.collection("channel_statistics");
      await collection.updateOne(
        { channelId },
        {
          $set: {
            ...statistics,
            lastUpdated: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (error: any) {
      throw new Error(`Failed to store channel statistics: ${error.message}`);
    }
  }

  // Future method for retrieving channel statistics from MongoDB
  async getChannelStatistics(channelId: string): Promise<any | null> {
    this.ensureConnected();

    try {
      const collection = this.db!.collection("channel_statistics");
      return await collection.findOne({ channelId });
    } catch (error: any) {
      throw new Error(
        `Failed to retrieve channel statistics: ${error.message}`
      );
    }
  }
}
