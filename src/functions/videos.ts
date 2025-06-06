import { google, youtube_v3 } from "googleapis";
import { getSubtitles } from "youtube-captions-scraper";
import {
  calculateLikeToViewRatio,
  calculateCommentToViewRatio,
} from "../utils/engagementCalculator.js";
import { parseYouTubeNumber } from "../utils/numberParser.js";
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
}

export interface ChannelOptions {
  channelId: string;
  maxResults?: number;
}

export interface TrendingOptions {
  regionCode?: string;
  categoryId?: string;
  maxResults?: number;
}

export class VideoManagement {
  private youtube: youtube_v3.Youtube;
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly ABSOLUTE_MAX_RESULTS = 500;

  constructor() {
    this.youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    });
  }

  async getVideo({ videoId, parts = ["snippet"] }: VideoOptions) {
    try {
      const response = await this.youtube.videos.list({
        part: parts,
        id: [videoId],
      });

      if (!response.data.items?.length) {
        throw new Error("Video not found.");
      }

      return response.data.items[0];
    } catch (error: any) {
      throw new Error(`Failed to retrieve video information: ${error.message}`);
    }
  }

  async searchVideos({ query, maxResults = 10 }: SearchOptions) {
    try {
      const results: youtube_v3.Schema$SearchResult[] = [];
      let nextPageToken: string | undefined = undefined;
      const targetResults = Math.min(maxResults, this.ABSOLUTE_MAX_RESULTS);

      while (results.length < targetResults) {
        const response: youtube_v3.Schema$SearchListResponse = (
          await this.youtube.search.list({
            part: ["snippet"],
            q: query,
            maxResults: Math.min(
              this.MAX_RESULTS_PER_PAGE,
              targetResults - results.length
            ),
            type: ["video"],
            pageToken: nextPageToken,
          })
        ).data;

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
        lang: lang || process.env.YOUTUBE_TRANSCRIPT_LANG || "en",
      });
      return transcript;
    } catch (error: any) {
      throw new Error(`Failed to retrieve transcript: ${error.message}`);
    }
  }

  async getChannelStatistics(
    channelId: string
  ): Promise<LeanChannelStatistics> {
    try {
      const response = await this.youtube.channels.list({
        part: ["snippet", "statistics"],
        id: [channelId],
      });

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

  async getChannelTopVideos({
    channelId,
    maxResults = 10,
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

        if (videosResponse.data.items) {
          videoDetails.push(...videosResponse.data.items);
        }
      }

      return videoDetails.slice(0, targetResults).map((video) => {
        const viewCount = parseYouTubeNumber(video.statistics?.viewCount);
        const likeCount = parseYouTubeNumber(video.statistics?.likeCount);
        const commentCount = parseYouTubeNumber(video.statistics?.commentCount);

        return {
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
        };
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
