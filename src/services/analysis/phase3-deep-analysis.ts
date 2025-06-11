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
  shouldSkipReAnalysis,
} from "./analysis.logic.js";

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
    const promisingChannels: any[] = [];
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

        const skipAnalysis = await shouldSkipReAnalysis(channelData);
        if (skipAnalysis && channelData.latestAnalysis) {
          const consistencyPercentage =
            channelData.latestAnalysis.consistencyPercentage;

          if (consistencyPercentage >= consistencyThreshold) {
            promisingChannels.push({
              channelData: channelData,
              consistencyPercentage: consistencyPercentage,
              outlierCount: channelData.latestAnalysis.outlierVideoCount || 0,
            });
          }
          continue;
        }

        const topVideos = await videoManagement.fetchChannelRecentTopVideos(
          channelId,
          publishedAfter
        );

        if (topVideos.length === 0) {
          console.error(
            `No videos found for channel ${channelId} in the specified time window`
          );
          continue;
        }

        const { consistencyPercentage, outlierCount } =
          calculateConsistencyPercentage(
            topVideos,
            channelData.latestStats.subscriberCount,
            outlierMultiplier
          );

        const now = new Date();
        const newAnalysis = {
          analyzedAt: now,
          consistencyPercentage,
          sourceVideoCount: topVideos.length,
          outlierVideoCount: outlierCount,
          outlierMagnitudeUsed: options.outlierMagnitude,
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
            `Failed to analyze channel ${channelId}: ${error.message}`
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
