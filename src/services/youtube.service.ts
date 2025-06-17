import { google, youtube_v3 } from "googleapis";
import { getSubtitles } from "youtube-captions-scraper";
import {
  calculateLikeToViewRatio,
  calculateCommentToViewRatio,
} from "../utils/engagementCalculator.js";
import { parseYouTubeNumber } from "../utils/numberParser.js";
import { formatDescription } from "../utils/textUtils.js";
import type {
  LeanChannelStatistics,
  LeanChannelTopVideo,
  LeanTrendingVideo,
} from "../types/youtube.js";

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

export class YoutubeService {
  private youtube: youtube_v3.Youtube;
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly ABSOLUTE_MAX_RESULTS = 500;
  private apiCreditsUsed: number = 0; // The new internal counter

  constructor() {
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

  async getVideo({ videoId, parts = ["snippet"] }: VideoOptions) {
    try {
      const response = await this.youtube.videos.list({
        part: parts,
        id: [videoId],
      });
      this.apiCreditsUsed += 1; // Add the cost after the call

      if (!response.data.items?.length) {
        throw new Error("Video not found.");
      }

      return response.data.items[0];
    } catch (error: any) {
      throw new Error(`Failed to retrieve video information: ${error.message}`);
    }
  }

  async searchVideos({
    query,
    maxResults = 10,
    order = "relevance",
    type = "video",
    channelId,
    videoDuration,
    publishedAfter,
    recency,
    regionCode,
  }: SearchOptions) {
    try {
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

        const response: youtube_v3.Schema$SearchListResponse = (
          await this.youtube.search.list(searchParams)
        ).data;
        this.apiCreditsUsed += 100; // Add the cost after the call

        if (!response.items?.length) {
          break;
        }

        results.push(...response.items);
        nextPageToken = response.nextPageToken || undefined;

        if (!nextPageToken) {
          break;
        }
      }

      return results.slice(0, targetResults);
    } catch (error: any) {
      throw new Error(`Failed to search videos: ${error.message}`);
    }
  }

  async getTranscript(videoId: string, lang?: string) {
    try {
      const transcript = await getSubtitles({
        videoID: videoId,
        lang: lang || "en",
      });
      return transcript;
    } catch (error: any) {
      throw new Error(`Failed to retrieve transcript: ${error.message}`);
    }
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

        const response = await this.youtube.channels.list({
          part: ["snippet", "statistics"],
          id: batch,
        });
        this.apiCreditsUsed += 1; // Add the cost after the call

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

  async getChannelStatistics(
    channelId: string
  ): Promise<LeanChannelStatistics> {
    try {
      const response = await this.youtube.channels.list({
        part: ["snippet", "statistics"],
        id: [channelId],
      });
      this.apiCreditsUsed += 1; // Add the cost after the call

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
    } catch (error: any) {
      throw new Error(
        `Failed to retrieve channel statistics: ${error.message}`
      );
    }
  }

  async fetchChannelRecentTopVideos(
    channelId: string,
    publishedAfter: string
  ): Promise<youtube_v3.Schema$Video[]> {
    try {
      const searchResponse = await this.youtube.search.list({
        channelId: channelId,
        part: ["snippet"],
        order: "viewCount",
        maxResults: 50,
        publishedAfter: publishedAfter,
        type: ["video"],
      });
      this.apiCreditsUsed += 100; // Add the cost after the call

      const videoIds =
        searchResponse.data.items
          ?.map((item) => item.id?.videoId)
          .filter((id): id is string => id !== undefined) || [];

      if (videoIds.length === 0) {
        return [];
      }

      const videosResponse = await this.youtube.videos.list({
        part: ["statistics", "contentDetails"],
        id: videoIds,
      });
      this.apiCreditsUsed += 1; // Add the cost after the call

      return videosResponse.data.items || [];
    } catch (error: any) {
      throw new Error(
        `Failed to fetch top videos for channel ${channelId}: ${error.message}`
      );
    }
  }

  async getChannelTopVideos({
    channelId,
    maxResults = 10,
    includeTags = false,
    descriptionDetail = "NONE",
  }: ChannelOptions): Promise<LeanChannelTopVideo[]> {
    try {
      const searchResults: youtube_v3.Schema$SearchResult[] = [];
      let nextPageToken: string | undefined = undefined;
      const targetResults = Math.min(maxResults, this.ABSOLUTE_MAX_RESULTS);

      while (searchResults.length < targetResults) {
        const searchResponse: youtube_v3.Schema$SearchListResponse = (
          await this.youtube.search.list({
            part: ["id"],
            channelId: channelId,
            maxResults: Math.min(
              this.MAX_RESULTS_PER_PAGE,
              targetResults - searchResults.length
            ),
            order: "viewCount",
            type: ["video"],
            pageToken: nextPageToken,
          })
        ).data;
        this.apiCreditsUsed += 100; // Add the cost after the call

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
        const videosResponse = await this.youtube.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: batch,
        });
        this.apiCreditsUsed += 1; // Add the cost after the call

        if (videosResponse.data.items) {
          videoDetails.push(...videosResponse.data.items);
        }
      }

      return videoDetails.slice(0, targetResults).map((video) => {
        const viewCount = parseYouTubeNumber(video.statistics?.viewCount);
        const likeCount = parseYouTubeNumber(video.statistics?.likeCount);
        const commentCount = parseYouTubeNumber(video.statistics?.commentCount);

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
    } catch (error: any) {
      throw new Error(
        `Failed to retrieve channel's top videos: ${error.message}`
      );
    }
  }

  async getTrendingVideos({
    regionCode = "US",
    categoryId,
    maxResults = 10,
  }: TrendingOptions): Promise<LeanTrendingVideo[]> {
    try {
      const params: youtube_v3.Params$Resource$Videos$List = {
        part: ["snippet", "statistics", "contentDetails"],
        chart: "mostPopular",
        regionCode: regionCode,
        maxResults: maxResults,
      };

      if (categoryId) {
        params.videoCategoryId = categoryId;
      }

      const response = await this.youtube.videos.list(params);
      this.apiCreditsUsed += 1; // Add the cost after the call

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
    } catch (error: any) {
      throw new Error(`Failed to retrieve trending videos: ${error.message}`);
    }
  }

  async getVideoCategories(regionCode: string = "US") {
    try {
      const response = await this.youtube.videoCategories.list({
        part: ["snippet"],
        regionCode: regionCode,
      });
      this.apiCreditsUsed += 1; // Add the cost after the call

      const categories = response.data.items?.map((category) => ({
        id: category.id,
        title: category.snippet?.title,
      }));

      return categories || [];
    } catch (error: any) {
      throw new Error(`Failed to retrieve video categories: ${error.message}`);
    }
  }
}
