import { FindConsistentOutlierChannelsOptions } from "../../types/analyzer.types.js";
import { YoutubeService } from "../../services/youtube.service.js";
import {
  calculateChannelAgePublishedAfter,
  isQuotaError,
} from "./analysis.logic.js";

export async function executeInitialCandidateSearch(
  options: FindConsistentOutlierChannelsOptions,
  youtubeService: YoutubeService
): Promise<string[]> {
  try {
    const publishedAfter = calculateChannelAgePublishedAfter(
      options.channelAge
    );

    const searchResults = await youtubeService.searchVideos({
      query: options.query,
      publishedAfter: publishedAfter,
      type: "video",
      order: "relevance",
      maxResults: 50,
      regionCode: options.regionCode,
      videoCategoryId: options.videoCategoryId,
    });

    const channelIds = new Set<string>();
    for (const video of searchResults) {
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
