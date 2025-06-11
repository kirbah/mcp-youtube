import { youtube_v3 } from "googleapis";
import { FindConsistentOutlierChannelsOptions } from "../../types/analyzer.types.js";
import { CacheService } from "../cache.service.js";
import { VideoManagement } from "../../functions/videos.js";
import {
  calculateChannelAgePublishedAfter,
  isQuotaError,
} from "./analysis.logic.js";

export async function executeInitialCandidateSearch(
  options: FindConsistentOutlierChannelsOptions,
  cacheService: CacheService,
  videoManagement: VideoManagement
): Promise<string[]> {
  try {
    const publishedAfter = calculateChannelAgePublishedAfter(
      options.channelAge
    );

    const searchParams: youtube_v3.Params$Resource$Search$List = {
      q: options.query,
      publishedAfter: publishedAfter,
      part: ["snippet"],
      type: ["video"],
      order: "relevance",
      maxResults: 50, // Assuming MAX_RESULTS_PER_PAGE from NicheAnalyzer
    };

    if (options.regionCode) {
      searchParams.regionCode = options.regionCode;
    }

    if (options.videoCategoryId) {
      searchParams.videoCategoryId = options.videoCategoryId;
    }

    let results = await cacheService.getCachedSearchResults(searchParams);

    if (!results) {
      const initialSearchResults = await videoManagement.searchVideos({
        query: options.query, // Add the required query
        publishedAfter: searchParams.publishedAfter,
        type: searchParams.type?.[0] as "video" | "channel", // Cast to expected type
        order: searchParams.order as "relevance" | "date" | "viewCount", // Cast to expected type
        maxResults: searchParams.maxResults,
        regionCode: searchParams.regionCode,
        videoCategoryId: searchParams.videoCategoryId,
      });
      results = initialSearchResults || [];
      await cacheService.storeCachedSearchResults(searchParams, results);
    }

    const channelIds = new Set<string>();
    for (const video of results) {
      if (video.snippet?.channelId) {
        channelIds.add(video.snippet.channelId);
      }
    }

    return Array.from(channelIds);
  } catch (error: any) {
    if (isQuotaError(error)) {
      throw new Error("YouTube API quota exceeded during Phase 1.");
    }
    throw new Error(`Phase 1 failed: ${error.message}`);
  }
}
