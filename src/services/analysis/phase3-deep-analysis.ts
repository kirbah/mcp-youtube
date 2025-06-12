import { youtube_v3 } from "googleapis"; // Import youtube_v3 for Schema$Video
import { FindConsistentOutlierChannelsOptions } from "../../types/analyzer.types.js";
import { CacheService } from "../cache.service.js";
import { VideoManagement } from "../../functions/videos.js";
import {
  ChannelCache,
  HistoricalAnalysisEntry,
  LatestAnalysis,
} from "./analysis.types.js";
import {
  calculateChannelAgePublishedAfter,
  getOutlierMultiplier,
  getConsistencyThreshold,
  isQuotaError,
  calculateConsistencyMetrics, // Changed from calculateConsistencyPercentage
} from "./analysis.logic.js";

// Tier 1: The "Analysis Brain" (channels_cache)
export const REANALYSIS_SUBSCRIBER_GROWTH_THRESHOLD = 1.2; // 20% growth

export async function executeDeepConsistencyAnalysis(
  prospects: string[],
  options: FindConsistentOutlierChannelsOptions,
  cacheService: CacheService,
  videoManagement: VideoManagement
): Promise<{ results: ChannelCache[]; quotaExceeded: boolean }> {
  try {
    const promisingChannels: ChannelCache[] = [];
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

        // Archive the Old Analysis if it exists
        let historicalEntry: HistoricalAnalysisEntry | undefined;
        if (channelData.latestAnalysis) {
          // Simply spread the entire existing object. It already has the right shape.
          historicalEntry = { ...channelData.latestAnalysis };
        }

        // Tier 1: The "Analysis Brain" (channels_cache) - Check Re-analysis Trigger
        // We only trigger a new "Deep Analysis" when the channel shows significant growth.
        // If subscriberCount has not increased by REANALYSIS_SUBSCRIBER_GROWTH_THRESHOLD (20%) or more, skip re-analysis.
        if (
          channelData.latestAnalysis &&
          channelData.latestStats.subscriberCount <
            channelData.latestAnalysis.subscriberCountAtAnalysis * // CORRECTED LOGIC
              REANALYSIS_SUBSCRIBER_GROWTH_THRESHOLD
        ) {
          // If the channel has not grown enough, and we have a previous analysis,
          // we can use the previous consistency percentage if it was promising.
          const consistencyPercentage =
            channelData.latestAnalysis.metrics[options.outlierMagnitude]
              .consistencyPercentage; // Reader Logic

          if (consistencyPercentage >= consistencyThreshold) {
            promisingChannels.push({
              ...channelData,
              // The analysis itself is old, but the STATUS of this finding is 'promising'.
              status: "analyzed_promising",
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

        // Perform New Pre-Computed Analysis (Writer Logic)
        const { sourceVideoCount, metrics } = calculateConsistencyMetrics(
          topVideos,
          channelData.latestStats.subscriberCount
        );

        const now = new Date();
        const newLatestAnalysis: LatestAnalysis = {
          analyzedAt: now,
          subscriberCountAtAnalysis: channelData.latestStats.subscriberCount, // Populate the new field
          sourceVideoCount: sourceVideoCount,
          metrics: metrics,
        };

        // Determine final status based on the requested consistency level
        const finalConsistencyPercentage =
          newLatestAnalysis.metrics[options.outlierMagnitude]
            .consistencyPercentage;
        const finalOutlierCount =
          newLatestAnalysis.metrics[options.outlierMagnitude].outlierVideoCount;

        const finalStatus =
          finalConsistencyPercentage >= consistencyThreshold
            ? "analyzed_promising"
            : "analyzed_low_consistency";

        // Consolidate database updates into a single operation
        const updatePayload: any = {
          $set: {
            latestAnalysis: newLatestAnalysis,
            status: finalStatus,
          },
        };

        if (historicalEntry) {
          updatePayload.$push = { analysisHistory: historicalEntry };
        }

        await cacheService.updateChannel(channelId, updatePayload);

        if (finalConsistencyPercentage >= consistencyThreshold) {
          promisingChannels.push({
            ...channelData, // The original channel data
            latestAnalysis: newLatestAnalysis, // Overwrite with the brand new analysis
            status: finalStatus as ChannelCache["status"], // Set the new status
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
