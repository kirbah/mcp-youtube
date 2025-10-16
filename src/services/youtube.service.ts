import { google, youtube_v3 } from "googleapis";
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
  LeanComment,
  LeanReply,
} from "../types/youtube.js";
import { GetVideoCommentsParams } from "../types/tools.js";

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
  "commentThreads.list": 1,
  "comments.list": 1,
};

export class YoutubeService {
  private youtube: youtube_v3.Youtube;
  private cacheService: CacheService;
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly ABSOLUTE_MAX_RESULTS = 500;
  private apiCreditsUsed: number = 0;

  constructor(cacheService: CacheService) {
    this.cacheService = cacheService;
    this.youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    });
  }

  public getApiCreditsUsed(): number {
    return this.apiCreditsUsed;
  }

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
        millisecondsToSubtract = 60 * 60 * 1000;
        break;
      case "pastDay":
        millisecondsToSubtract = 24 * 60 * 60 * 1000;
        break;
      case "pastWeek":
        millisecondsToSubtract = 7 * 24 * 60 * 60 * 1000;
        break;
      case "pastMonth":
        millisecondsToSubtract = 30 * 24 * 60 * 60 * 1000;
        break;
      case "pastQuarter":
        millisecondsToSubtract = 90 * 24 * 60 * 60 * 1000;
        break;
      case "pastYear":
        millisecondsToSubtract = 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        return "";
    }

    const targetTime = new Date(now.getTime() - millisecondsToSubtract);

    if (["pastMonth", "pastQuarter", "pastYear"].includes(recency)) {
      targetTime.setDate(1);
    }

    return targetTime.toISOString();
  }

  async getVideo(
    options: VideoOptions
  ): Promise<youtube_v3.Schema$Video | null> {
    const { videoId, parts = ["snippet"] } = options;

    const cacheKey = videoId;

    const operation = async (): Promise<youtube_v3.Schema$Video | null> => {
      try {
        const response = await this.trackCost(
          () => this.youtube.videos.list({ part: parts, id: [videoId] }),
          API_COSTS["videos.list"]
        );
        return response.data.items?.[0] ?? null;
      } catch (error) {
        throw new Error(
          `YouTube API call for getVideo failed for videoId: ${videoId}`,
          { cause: error }
        );
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
    const cacheKey = channelId;

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
      options
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

  async getVideoComments(
    options: GetVideoCommentsParams
  ): Promise<LeanComment[]> {
    const cacheKey = this.cacheService.createOperationKey(
      "getVideoComments",
      options
    );

    const operation = async (): Promise<LeanComment[]> => {
      try {
        const {
          videoId,
          maxResults,
          order,
          maxReplies = 0,
          commentDetail,
        } = options;

        const commentThreadsResponse = await this.trackCost(
          () =>
            this.youtube.commentThreads.list({
              part: ["snippet"],
              videoId: videoId,
              maxResults: maxResults,
              order: order,
            }),
          API_COSTS["commentThreads.list"]
        );

        const topLevelComments = commentThreadsResponse.data.items || [];

        let allReplies: youtube_v3.Schema$Comment[][] = [];
        if (maxReplies > 0 && topLevelComments.length > 0) {
          const replyPromises = topLevelComments.map((commentThread) => {
            const parentId = commentThread.id;
            if (!parentId) return Promise.resolve([]);
            return this.trackCost(
              () =>
                this.youtube.comments.list({
                  part: ["snippet"],
                  parentId: parentId,
                  maxResults: maxReplies,
                }),
              API_COSTS["comments.list"]
            ).then((res) => res.data.items || []);
          });
          allReplies = await Promise.all(replyPromises);
        }

        return topLevelComments.map((commentThread, index) => {
          const topLevelSnippet =
            commentThread.snippet?.topLevelComment?.snippet;
          const replies = allReplies[index] || [];

          const leanReplies: LeanReply[] = replies.map((reply) => {
            const replySnippet = reply.snippet;
            return {
              replyId: reply.id ?? "",
              author: replySnippet?.authorDisplayName ?? "",
              text:
                commentDetail === "SNIPPET"
                  ? replySnippet?.textDisplay?.substring(0, 200) || ""
                  : replySnippet?.textDisplay || "",
              publishedAt: replySnippet?.publishedAt ?? "",
              likeCount: replySnippet?.likeCount || 0,
            };
          });

          return {
            commentId: commentThread.id ?? "",
            author: topLevelSnippet?.authorDisplayName ?? "",
            text:
              commentDetail === "SNIPPET"
                ? topLevelSnippet?.textDisplay?.substring(0, 200) || ""
                : topLevelSnippet?.textDisplay || "",
            publishedAt: topLevelSnippet?.publishedAt ?? "",
            likeCount: topLevelSnippet?.likeCount || 0,
            replies: leanReplies,
          };
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "response" in error &&
          error.response &&
          typeof error.response === "object" &&
          "status" in error.response &&
          error.response.status === 403
        ) {
          // Define a type for the expected error structure
          type YouTubeApiError = {
            error: {
              errors: [{ reason: string }];
            };
          };

          // You might need to adjust the type assertion based on your error structure
          const errorData = (error.response as { data?: YouTubeApiError })
            .data;
          if (
            errorData?.error?.errors?.[0]?.reason === "commentsDisabled"
          ) {
            return [];
          }
        }
        throw new Error(
          `YouTube API call for getVideoComments failed for videoId: ${options.videoId}`,
          { cause: error }
        );
      }
    };

    return this.cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.DYNAMIC,
      CACHE_COLLECTIONS.VIDEO_COMMENTS,
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
