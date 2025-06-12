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

        // Archive the Old Analysis if it exists
        let historicalEntry: HistoricalAnalysisEntry | undefined;
        if (channelData.latestAnalysis) {
          historicalEntry = {
            analyzedAt: channelData.latestAnalysis.analyzedAt,
            subscriberCountAtAnalysis: channelData.latestStats.subscriberCount,
            sourceVideoCount: channelData.latestAnalysis.sourceVideoCount,
            metrics: {
              STANDARD: {
                consistencyPercentage:
                  channelData.latestAnalysis.metrics.STANDARD
                    .consistencyPercentage,
                outlierVideoCount:
                  channelData.latestAnalysis.metrics.STANDARD.outlierVideoCount,
              },
              STRONG: {
                consistencyPercentage:
                  channelData.latestAnalysis.metrics.STRONG
                    .consistencyPercentage,
                outlierVideoCount:
                  channelData.latestAnalysis.metrics.STRONG.outlierVideoCount,
              },
            },
          };
        }

        // Tier 1: The "Analysis Brain" (channels_cache) - Check Re-analysis Trigger
        // We only trigger a new "Deep Analysis" when the channel shows significant growth.
        // If subscriberCount has not increased by REANALYSIS_SUBSCRIBER_GROWTH_THRESHOLD (20%) or more, skip re-analysis.
        if (
          channelData.latestAnalysis &&
          channelData.latestStats.subscriberCount <
            channelData.latestAnalysis.metrics.STANDARD.consistencyPercentage * // Using STANDARD consistency for re-analysis trigger
              REANALYSIS_SUBSCRIBER_GROWTH_THRESHOLD
        ) {
          // If the channel has not grown enough, and we have a previous analysis,
          // we can use the previous consistency percentage if it was promising.
          const consistencyPercentage =
            channelData.latestAnalysis.metrics[options.outlierMagnitude]
              .consistencyPercentage; // Reader Logic

          if (consistencyPercentage >= consistencyThreshold) {
            promisingChannels.push({
              channelData: channelData,
              consistencyPercentage: consistencyPercentage,
              outlierCount:
                channelData.latestAnalysis.metrics[options.outlierMagnitude]
                  .outlierVideoCount,
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
          sourceVideoCount: sourceVideoCount,
          metrics: metrics,
        };

        // Update the channel cache with the new latest analysis and push old analysis to history
        if (historicalEntry) {
          await cacheService.updateChannelWithHistory(
            channelId,
            newLatestAnalysis,
            historicalEntry
          );
        } else {
          // If no historical entry, just set the latest analysis
          await cacheService.updateChannel(channelId, {
            latestAnalysis: newLatestAnalysis,
          });
        }

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

        await cacheService.updateChannel(channelId, { status: finalStatus });

        if (finalConsistencyPercentage >= consistencyThreshold) {
          promisingChannels.push({
            channelData: {
              ...channelData,
              latestAnalysis: newLatestAnalysis,
              status: finalStatus as ChannelCache["status"],
            },
            consistencyPercentage: finalConsistencyPercentage,
            outlierCount: finalOutlierCount,
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
