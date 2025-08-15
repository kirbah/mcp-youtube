import { google, youtube_v3 } from "googleapis";
import { getSubtitles } from "youtube-caption-extractor";
import {
  calculateLikeToViewRatio,
  calculateCommentToViewRatio,
} from "../utils/engagementCalculator.js";
import { parseYouTubeNumber } from "../utils/numberParser.js";
import { formatDescription } from "../utils/textUtils.js";
import { CacheService } from "./cache.service.js";
import { CACHE_TTLS, CACHE_COLLECTIONS } from "../config/cache.config.js";
import type {
  LeanChannelStatistics,
  LeanChannelTopVideo,
  LeanTrendingVideo,
} from "../types/youtube.js";

interface Subtitle {
  start: string;
  dur: string;
  text: string;
}

export interface VideoOptions {
  videoId: string;
  parts?: string[];
}

export interface SearchOptions {
  query: string;
  maxResults?: number;
  order?: "relevance" | "date" | "viewCount";
  type?: "video" | "channel";
  channelId?: string;
  videoDuration?: "any" | "short" | "medium" | "long";
  publishedAfter?: string;
  recency?:
    | "any"
    | "pastHour"
    | "pastDay"
    | "pastWeek"
    | "pastMonth"
    | "pastQuarter"
    | "pastYear";
  regionCode?: string;
  videoCategoryId?: string; // Added
}

export interface ChannelOptions {
  channelId: string;
  maxResults?: number;
  includeTags?: boolean;
  descriptionDetail?: "NONE" | "SNIPPET" | "LONG";
}

export interface TrendingOptions {
  regionCode?: string;
  categoryId?: string;
  maxResults?: number;
}

const API_COSTS = {
  // Read-operations
  "search.list": 100,
  "videos.list": 1,
  "channels.list": 1,
  "videoCategories.list": 1,

  // Custom/external library calls that don't use the official API quota
  getTranscript: 0,
};

export class YoutubeService {
  private youtube: youtube_v3.Youtube;
  private cacheService: CacheService;
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly ABSOLUTE_MAX_RESULTS = 500;
  private apiCreditsUsed: number = 0; // The new internal counter

  constructor(cacheService: CacheService) {
    this.cacheService = cacheService;
    this.youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    });
  }

  // New Method: A public getter for the orchestrator to call
  public getApiCreditsUsed(): number {
    return this.apiCreditsUsed;
  }

  // New Method: Resets the counter for a fresh run
  public resetApiCreditsUsed(): void {
    this.apiCreditsUsed = 0;
  }

  private async trackCost<T>(
    operation: () => Promise<T>,
    cost: number
  ): Promise<T> {
    this.apiCreditsUsed += cost;
    return operation();
  }

  private calculatePublishedAfter(recency: string): string {
    const now = new Date();
    let millisecondsToSubtract = 0;

    switch (recency) {
      case "pastHour":
        millisecondsToSubtract = 60 * 60 * 1000; // 1 hour
        break;
      case "pastDay":
        millisecondsToSubtract = 24 * 60 * 60 * 1000; // 1 day
        break;
      case "pastWeek":
        millisecondsToSubtract = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case "pastMonth":
        millisecondsToSubtract = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      case "pastQuarter":
        millisecondsToSubtract = 90 * 24 * 60 * 60 * 1000; // 90 days
        break;
      case "pastYear":
        millisecondsToSubtract = 365 * 24 * 60 * 60 * 1000; // 365 days
        break;
      default:
        return "";
    }

    const targetTime = new Date(now.getTime() - millisecondsToSubtract);

    // If recency is pastMonth, pastQuarter, or pastYear, set the day of the month to the 1st
    if (["pastMonth", "pastQuarter", "pastYear"].includes(recency)) {
      targetTime.setDate(1);
    }

    return targetTime.toISOString();
  }

  async getVideo(
    options: VideoOptions
  ): Promise<youtube_v3.Schema$Video | null> {
    const { videoId, parts = ["snippet"] } = options;

    // 1. Create a unique key. For an entity like a video, the ID is perfect.
    const cacheKey = videoId;

    // 2. Define the 'operation' to run on a cache miss. This is your original logic.
    const operation = async (): Promise<youtube_v3.Schema$Video | null> => {
      try {
        const response = await this.trackCost(
          () => this.youtube.videos.list({ part: parts, id: [videoId] }),
          API_COSTS["videos.list"] // Assuming API_COSTS is defined in this file
        );
        // Return the video object or null if not found
        return response.data.items?.[0] ?? null;
      } catch (error) {
        throw new Error(
          `YouTube API call for getVideo failed for videoId: ${videoId}`,
          { cause: error }
        );
      }
    };

    // 3. Use the CacheService to get data. It will either hit the cache or run the operation.
    // We don't store params because the key itself is the primary identifier.
    return this.cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.STANDARD,
      CACHE_COLLECTIONS.VIDEO_DETAILS,
      options,
      ["snippet.thumbnails"]
    );
  }

  async searchVideos(
    options: SearchOptions
  ): Promise<youtube_v3.Schema$SearchResult[]> {
    const cacheKey = this.cacheService.createOperationKey(
      "searchVideos",
      options
    );

    const operation = async (): Promise<youtube_v3.Schema$SearchResult[]> => {
      try {
        const {
          query,
          maxResults = 10,
          order = "relevance",
          type = "video",
          channelId,
          videoDuration,
          publishedAfter,
          recency,
          regionCode,
        } = options;

        const results: youtube_v3.Schema$SearchResult[] = [];
        let nextPageToken: string | undefined = undefined;
        const targetResults = Math.min(maxResults, this.ABSOLUTE_MAX_RESULTS);

        // Calculate publishedAfter from recency if provided
        let calculatedPublishedAfter = publishedAfter;
        if (recency && recency !== "any") {
          calculatedPublishedAfter = this.calculatePublishedAfter(recency);
        }

        while (results.length < targetResults) {
          const searchParams: youtube_v3.Params$Resource$Search$List = {
            part: ["snippet"],
            q: query,
            maxResults: Math.min(
              this.MAX_RESULTS_PER_PAGE,
              targetResults - results.length
            ),
            type: [type],
            order: order,
            pageToken: nextPageToken,
          };

          // Add optional parameters if provided
          if (channelId) {
            searchParams.channelId = channelId;
          }

          if (videoDuration && videoDuration !== "any") {
            searchParams.videoDuration = videoDuration;
          }

          if (calculatedPublishedAfter) {
            searchParams.publishedAfter = calculatedPublishedAfter;
          }

          if (regionCode) {
            searchParams.regionCode = regionCode;
          }

          const response = await this.trackCost(
            () => this.youtube.search.list(searchParams),
            API_COSTS["search.list"]
          );
          const searchResponse: youtube_v3.Schema$SearchListResponse =
            response.data;

          if (!searchResponse.items?.length) {
            break;
          }

          results.push(...searchResponse.items);
          nextPageToken = searchResponse.nextPageToken || undefined;

          if (!nextPageToken) {
            break;
          }
        }

        return results.slice(0, targetResults);
      } catch (error) {
        throw new Error(`YouTube API call for searchVideos failed`, {
          cause: error,
        });
      }
    };

    return this.cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.STANDARD,
      CACHE_COLLECTIONS.VIDEO_DETAILS,
      options,
      ["snippet.thumbnails"]
    );
  }

  async getTranscript(videoId: string, lang?: string): Promise<Subtitle[]> {
    const cacheKey = this.cacheService.createOperationKey("getTranscript", {
      videoId,
      lang,
    });

    const operation = async (): Promise<Subtitle[]> => {
      try {
        const transcript = await getSubtitles({
          videoID: videoId,
          lang: lang || "en",
        });
        return transcript;
      } catch (error) {
        throw new Error(
          `API call for getTranscript failed for videoId: ${videoId}`,
          { cause: error }
        );
      }
    };

    return this.cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.STATIC,
      CACHE_COLLECTIONS.TRANSCRIPTS
    );
  }

  async batchFetchChannelStatistics(
    channelIds: string[]
  ): Promise<Map<string, youtube_v3.Schema$Channel>> {
    const results = new Map<string, youtube_v3.Schema$Channel>();

    if (channelIds.length === 0) {
      return results;
    }

    try {
      const batchSize = 50;
      for (let i = 0; i < channelIds.length; i += batchSize) {
        const batch = channelIds.slice(i, i + batchSize);

        const response = await this.trackCost(
          () =>
            this.youtube.channels.list({
              part: ["snippet", "statistics"],
              id: batch,
            }),
          API_COSTS["channels.list"]
        );

        if (response.data.items) {
          for (const channel of response.data.items) {
            if (channel.id) {
              results.set(channel.id, channel);
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`API call for batchFetchChannelStatistics failed`, {
        cause: error,
      });
    }

    return results;
  }

  async getChannelStatistics(
    channelId: string
  ): Promise<LeanChannelStatistics> {
    const cacheKey = channelId; // Use channelId directly as the key

    const operation = async (): Promise<LeanChannelStatistics> => {
      try {
        const response = await this.trackCost(
          () =>
            this.youtube.channels.list({
              part: ["snippet", "statistics"],
              id: [channelId],
            }),
          API_COSTS["channels.list"]
        );

        if (!response.data.items?.length) {
          throw new Error("Channel not found.");
        }

        const channel = response.data.items[0];
        return {
          channelId: channelId,
          title: channel.snippet?.title,
          subscriberCount: parseYouTubeNumber(
            channel.statistics?.subscriberCount
          ),
          viewCount: parseYouTubeNumber(channel.statistics?.viewCount),
          videoCount: parseYouTubeNumber(channel.statistics?.videoCount),
          createdAt: channel.snippet?.publishedAt,
        };
      } catch (error) {
        throw new Error(
          `YouTube API call for getChannelStatistics failed for channelId: ${channelId}`,
          { cause: error }
        );
      }
    };

    return this.cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.STANDARD,
      CACHE_COLLECTIONS.CHANNEL_STATS
    );
  }

  async fetchChannelRecentTopVideos(
    channelId: string,
    publishedAfter: string
  ): Promise<youtube_v3.Schema$Video[]> {
    const cacheKey = this.cacheService.createOperationKey(
      "fetchChannelRecentTopVideos",
      { channelId, publishedAfter }
    );

    const operation = async (): Promise<youtube_v3.Schema$Video[]> => {
      try {
        const searchResponse = await this.trackCost(
          () =>
            this.youtube.search.list({
              channelId: channelId,
              part: ["snippet"],
              order: "viewCount",
              maxResults: 50,
              publishedAfter: publishedAfter,
              type: ["video"],
            }),
          API_COSTS["search.list"]
        );

        const videoIds =
          searchResponse.data.items
            ?.map((item) => item.id?.videoId)
            .filter((id): id is string => id !== undefined) || [];

        if (videoIds.length === 0) {
          return [];
        }

        const videosResponse = await this.trackCost(
          () =>
            this.youtube.videos.list({
              part: ["statistics", "contentDetails"],
              id: videoIds,
            }),
          API_COSTS["videos.list"]
        );

        return videosResponse.data.items || [];
      } catch (error) {
        throw new Error(
          `YouTube API call for fetchChannelRecentTopVideos failed for channelId: ${channelId} and publishedAfter: ${publishedAfter}`,
          { cause: error }
        );
      }
    };

    return this.cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.SEMI_STATIC,
      CACHE_COLLECTIONS.CHANNEL_RECENT_TOP_VIDEOS,
      { channelId, publishedAfter }
    );
  }

  async getChannelTopVideos(
    options: ChannelOptions
  ): Promise<LeanChannelTopVideo[]> {
    const cacheKey = this.cacheService.createOperationKey(
      "getChannelTopVideos",
      options
    );

    const operation = async (): Promise<LeanChannelTopVideo[]> => {
      try {
        const {
          channelId,
          maxResults = 10,
          includeTags = false,
          descriptionDetail = "NONE",
        } = options;

        const searchResults: youtube_v3.Schema$SearchResult[] = [];
        let nextPageToken: string | undefined = undefined;
        const targetResults = Math.min(maxResults, this.ABSOLUTE_MAX_RESULTS);

        while (searchResults.length < targetResults) {
          const response = await this.trackCost(
            () =>
              this.youtube.search.list({
                part: ["id"],
                channelId: channelId,
                maxResults: Math.min(
                  this.MAX_RESULTS_PER_PAGE,
                  targetResults - searchResults.length
                ),
                order: "viewCount",
                type: ["video"],
                pageToken: nextPageToken,
              }),
            API_COSTS["search.list"]
          );
          const searchResponse: youtube_v3.Schema$SearchListResponse =
            response.data;

          if (!searchResponse.items?.length) {
            break;
          }

          searchResults.push(...searchResponse.items);
          nextPageToken = searchResponse.nextPageToken || undefined;

          if (!nextPageToken) {
            break;
          }
        }

        if (!searchResults.length) {
          throw new Error("No videos found.");
        }

        const videoIds = searchResults
          .map((item) => item.id?.videoId)
          .filter((id): id is string => id !== undefined);

        // Retrieve video details in batches of 50
        const videoDetails: youtube_v3.Schema$Video[] = [];
        for (let i = 0; i < videoIds.length; i += this.MAX_RESULTS_PER_PAGE) {
          const batch = videoIds.slice(i, i + this.MAX_RESULTS_PER_PAGE);
          const response = await this.trackCost(
            () =>
              this.youtube.videos.list({
                part: ["snippet", "statistics", "contentDetails"],
                id: batch,
              }),
            API_COSTS["videos.list"]
          );
          if (response.data.items) {
            videoDetails.push(...response.data.items);
          }
        }

        return videoDetails.slice(0, targetResults).map((video) => {
          const viewCount = parseYouTubeNumber(video.statistics?.viewCount);
          const likeCount = parseYouTubeNumber(video.statistics?.likeCount);
          const commentCount = parseYouTubeNumber(
            video.statistics?.commentCount
          );

          const formattedDescription = formatDescription(
            video.snippet?.description,
            descriptionDetail
          );

          const baseVideo = {
            id: video.id,
            title: video.snippet?.title,
            publishedAt: video.snippet?.publishedAt,
            duration: video.contentDetails?.duration,
            viewCount: viewCount,
            likeCount: likeCount,
            commentCount: commentCount,
            likeToViewRatio: calculateLikeToViewRatio(viewCount, likeCount),
            commentToViewRatio: calculateCommentToViewRatio(
              viewCount,
              commentCount
            ),
            categoryId: video.snippet?.categoryId ?? null,
            defaultLanguage: video.snippet?.defaultLanguage ?? null,
          };

          // Conditionally add description if not NONE
          const videoWithDescription =
            formattedDescription !== undefined
              ? { ...baseVideo, description: formattedDescription }
              : baseVideo;

          return includeTags
            ? { ...videoWithDescription, tags: video.snippet?.tags ?? [] }
            : videoWithDescription;
        });
      } catch (error) {
        throw new Error(
          `YouTube API call for getChannelTopVideos failed for channelId: ${options.channelId}`,
          { cause: error }
        );
      }
    };

    return this.cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.SEMI_STATIC,
      CACHE_COLLECTIONS.CHANNEL_TOP_VIDEOS,
      options // Pass the original parameters for storage!
    );
  }

  async getTrendingVideos(
    options: TrendingOptions
  ): Promise<LeanTrendingVideo[]> {
    const cacheKey = this.cacheService.createOperationKey(
      "getTrendingVideos",
      options
    );

    const operation = async (): Promise<LeanTrendingVideo[]> => {
      try {
        const { regionCode = "US", categoryId, maxResults = 10 } = options;

        const params: youtube_v3.Params$Resource$Videos$List = {
          part: ["snippet", "statistics", "contentDetails"],
          chart: "mostPopular",
          regionCode: regionCode,
          maxResults: maxResults,
        };

        if (categoryId) {
          params.videoCategoryId = categoryId;
        }

        const response = await this.trackCost(
          () => this.youtube.videos.list(params),
          API_COSTS["videos.list"]
        );

        return (
          response.data.items?.map((video) => {
            const viewCount = parseYouTubeNumber(video.statistics?.viewCount);
            const likeCount = parseYouTubeNumber(video.statistics?.likeCount);
            const commentCount = parseYouTubeNumber(
              video.statistics?.commentCount
            );

            return {
              id: video.id,
              title: video.snippet?.title,
              channelId: video.snippet?.channelId,
              channelTitle: video.snippet?.channelTitle,
              publishedAt: video.snippet?.publishedAt,
              duration: video.contentDetails?.duration,
              viewCount: viewCount,
              likeCount: likeCount,
              commentCount: commentCount,
              likeToViewRatio: calculateLikeToViewRatio(viewCount, likeCount),
              commentToViewRatio: calculateCommentToViewRatio(
                viewCount,
                commentCount
              ),
            };
          }) || []
        );
      } catch (error) {
        throw new Error(`YouTube API call for getTrendingVideos failed`, {
          cause: error,
        });
      }
    };

    return this.cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.DYNAMIC,
      CACHE_COLLECTIONS.TRENDING_VIDEOS,
      options
    );
  }

  async getVideoCategories(regionCode: string = "US") {
    const cacheKey = this.cacheService.createOperationKey(
      "getVideoCategories",
      {
        regionCode,
      }
    );

    const operation = async () => {
      try {
        const response = await this.trackCost(
          () =>
            this.youtube.videoCategories.list({
              part: ["snippet"],
              regionCode: regionCode,
            }),
          API_COSTS["videoCategories.list"]
        );

        const categories = response.data.items?.map((category) => ({
          id: category.id,
          title: category.snippet?.title,
        }));

        return categories || [];
      } catch (error) {
        throw new Error(
          `YouTube API call for getVideoCategories failed for regionCode: ${regionCode}`,
          { cause: error }
        );
      }
    };

    return this.cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.STATIC,
      CACHE_COLLECTIONS.VIDEO_CATEGORIES,
      { regionCode }
    );
  }
}
