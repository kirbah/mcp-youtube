import { youtube_v3 } from "googleapis"; // Import youtube_v3 for Schema$Video
import { FindConsistentOutlierChannelsOptions } from "../../types/analyzer.types.js";
import { CacheService } from "../cache.service.js";
import { VideoManagement } from "../../functions/videos.js";
import { ChannelCache } from "./analysis.types.js";
import {
  calculateChannelAgePublishedAfter,
  getOutlierMultiplier,
  getConsistencyThreshold,
  isQuotaError,
  calculateConsistencyPercentage,
} from "./analysis.logic.js";

// Tier 1: The "Analysis Brain" (channels_cache)
export const REANALYSIS_SUBSCRIBER_GROWTH_THRESHOLD = 1.2; // 20% growth

export async function executeDeepConsistencyAnalysis(
  prospects: string[],
  options: FindConsistentOutlierChannelsOptions,
  cacheService: CacheService,
  videoManagement: VideoManagement
): Promise<{
  results: Array<{
    channelData: ChannelCache;
    consistencyPercentage: number;
    outlierCount: number;
  }>;
  quotaExceeded: boolean;
}> {
  try {
    const promisingChannels: {
      channelData: ChannelCache;
      consistencyPercentage: number;
      outlierCount: number;
    }[] = [];
    const publishedAfter = calculateChannelAgePublishedAfter(
      options.channelAge
    );
    const outlierMultiplier = getOutlierMultiplier(options.outlierMagnitude);
    const consistencyThreshold = getConsistencyThreshold(
      options.consistencyLevel
    );

    let quotaExceeded = false;

    for (const channelId of prospects) {
      try {
        const channelData = (
          await cacheService.findChannelsByIds([channelId])
        )[0];

        if (!channelData) {
          console.error(
            `Channel ${channelId} not found in cache during Phase 3`
          );
          continue;
        }

        // Tier 1: The "Analysis Brain" (channels_cache) - Check Re-analysis Trigger
        // We only trigger a new "Deep Analysis" when the channel shows significant growth.
        // If subscriberCount has not increased by REANALYSIS_SUBSCRIBER_GROWTH_THRESHOLD (20%) or more, skip re-analysis.
        if (
          channelData.latestAnalysis &&
          channelData.latestStats.subscriberCount <
            channelData.latestAnalysis.subscriberCountAtAnalysis *
              REANALYSIS_SUBSCRIBER_GROWTH_THRESHOLD
        ) {
          // If the channel has not grown enough, and we have a previous analysis,
          // we can use the previous consistency percentage if it was promising.
          const consistencyPercentage =
            channelData.latestAnalysis.consistencyPercentage;

          if (consistencyPercentage >= consistencyThreshold) {
            promisingChannels.push({
              channelData: channelData,
              consistencyPercentage: consistencyPercentage,
              outlierCount: channelData.latestAnalysis.outlierVideoCount || 0,
            });
          }
          continue; // Skip to the next channel
        }

        // Tier 2: The "Working Memory" (video_list_cache) - Check for cached video list
        let topVideos: youtube_v3.Schema$Video[] | null = null;
        const cachedVideoList = await cacheService.getVideoListCache(channelId);

        if (cachedVideoList) {
          topVideos = cachedVideoList.videos;
        } else {
          // No cached video list or it's stale, fetch new videos
          topVideos = await videoManagement.fetchChannelRecentTopVideos(
            channelId,
            publishedAfter
          );
          if (topVideos.length > 0) {
            await cacheService.setVideoListCache(channelId, topVideos);
          }
        }

        if (!topVideos || topVideos.length === 0) {
          console.error(
            `No videos found for channel ${channelId} in the specified time window or cache`
          );
          continue;
        }

        const { consistencyPercentage, outlierCount, sourceVideoCount } =
          calculateConsistencyPercentage(
            topVideos,
            channelData.latestStats.subscriberCount,
            outlierMultiplier
          );

        const now = new Date();
        const newAnalysis = {
          analyzedAt: now,
          consistencyPercentage,
          sourceVideoCount: sourceVideoCount, // No longer 50, but the actual number of long-form videos
          outlierVideoCount: outlierCount,
          outlierMagnitudeUsed: options.outlierMagnitude,
          subscriberCountAtAnalysis: channelData.latestStats.subscriberCount, // Save current subscriber count
        };

        const historyEntry = {
          analyzedAt: now,
          consistencyPercentage,
          subscriberCountAtAnalysis: channelData.latestStats.subscriberCount,
          videoCountAtAnalysis: channelData.latestStats.videoCount,
          subscriberCount: channelData.latestStats.subscriberCount,
          videoCount: channelData.latestStats.videoCount,
          viewCount: channelData.latestStats.viewCount,
        };

        const finalStatus =
          consistencyPercentage >= consistencyThreshold
            ? "analyzed_promising"
            : "analyzed_low_consistency";

        await cacheService.updateChannelWithHistory(
          channelId,
          newAnalysis,
          finalStatus,
          historyEntry
        );

        if (consistencyPercentage >= consistencyThreshold) {
          promisingChannels.push({
            channelData: {
              ...channelData,
              latestAnalysis: newAnalysis,
              status: finalStatus as ChannelCache["status"],
            },
            consistencyPercentage: consistencyPercentage,
            outlierCount: outlierCount,
          });
        }
      } catch (error: any) {
        if (isQuotaError(error)) {
          console.error("YouTube API quota exceeded. Stopping analysis.");
          quotaExceeded = true;
          break;
        } else {
          console.error(
            `Failed to analyze channel ${channelId}: ${
              (error as Error).message
            }`
          );
          continue;
        }
      }
    }

    return {
      results: promisingChannels,
      quotaExceeded: quotaExceeded,
    };
  } catch (error: any) {
    throw new Error(`Phase 3 failed: ${error.message}`);
  }
}
