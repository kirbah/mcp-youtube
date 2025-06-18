import { youtube_v3 } from "googleapis"; // Import youtube_v3 for Schema$Video
import { FindConsistentOutlierChannelsOptions } from "../../types/analyzer.types.js";
import { NicheRepository } from "./niche.repository.js";
import { YoutubeService } from "../../services/youtube.service.js";
import { UpdateFilter } from "mongodb"; // Import UpdateFilter
import {
  ChannelCache,
  HistoricalAnalysisEntry,
  LatestAnalysis,
} from "./analysis.types.js";
import {
  calculateChannelAgePublishedAfter,
  getConsistencyThreshold,
  isQuotaError,
  calculateConsistencyMetrics, // Changed from calculateConsistencyPercentage
} from "./analysis.logic.js";

// Tier 1: The "Analysis Brain" (channels_cache)
export const REANALYSIS_SUBSCRIBER_GROWTH_THRESHOLD = 1.2; // 20% growth

// Define statuses that should prevent any further analysis.
const NO_REANALYSIS_STATUSES: ReadonlySet<ChannelCache["status"]> = new Set([
  "archived_unreplicable",
  "archived_niche_mismatch",
]);

// Define statuses that should be preserved during an analysis refresh, but still allow re-analysis.
const PRESERVABLE_STATUSES: ReadonlySet<ChannelCache["status"]> = new Set([
  "analyzed_promising_prime_candidate",
  "analyzed_promising_monitor",
]);

export async function executeDeepConsistencyAnalysis(
  prospects: string[],
  options: FindConsistentOutlierChannelsOptions,
  youtubeService: YoutubeService,
  nicheRepository: NicheRepository
): Promise<{ results: ChannelCache[]; quotaExceeded: boolean }> {
  try {
    const promisingChannels: ChannelCache[] = [];
    const publishedAfter = calculateChannelAgePublishedAfter(
      options.channelAge
    );
    const consistencyThreshold = getConsistencyThreshold(
      options.consistencyLevel
    );

    let quotaExceeded = false;

    for (const channelId of prospects) {
      try {
        const channelData = (
          await nicheRepository.findChannelsByIds([channelId])
        )[0];

        if (!channelData) {
          console.error(
            `Channel ${channelId} not found in cache during Phase 3`
          );
          continue;
        }

        // If the channel has a status that prevents re-analysis, skip it entirely.
        if (NO_REANALYSIS_STATUSES.has(channelData.status)) {
          continue;
        }

        // STEP 1: Determine the status to be used at the end of the process
        let finalStatusToPersist = channelData.status;
        const isPreservableStatus = PRESERVABLE_STATUSES.has(
          channelData.status
        );

        // STEP 2: Check Re-analysis Trigger
        const needsReanalysis =
          !channelData.latestAnalysis || // Always analyze if no previous analysis exists
          channelData.latestStats.subscriberCount >=
            channelData.latestAnalysis.subscriberCountAtAnalysis *
              REANALYSIS_SUBSCRIBER_GROWTH_THRESHOLD;

        if (!needsReanalysis) {
          // If no re-analysis is needed, check if it's a promising candidate based on old data
          // and add it to the results if it is.
          const consistencyPercentage =
            channelData.latestAnalysis!.metrics[options.outlierMagnitude]
              .consistencyPercentage;
          if (consistencyPercentage >= consistencyThreshold) {
            promisingChannels.push(channelData);
          }
          continue; // Skip to the next channel
        }

        // PROCEED WITH RE-ANALYSIS

        // Archive the Old Analysis if it exists
        const historicalEntry: HistoricalAnalysisEntry | undefined =
          channelData.latestAnalysis
            ? { ...channelData.latestAnalysis }
            : undefined;

        // Directly fetch new videos using the YoutubeService's cached method
        const topVideos: youtube_v3.Schema$Video[] =
          await youtubeService.fetchChannelRecentTopVideos(
            channelId,
            publishedAfter
          );

        if (!topVideos || topVideos.length === 0) {
          console.error(
            `No videos found for channel ${channelId} in the specified time window`
          );
          continue;
        }

        // Perform New Pre-Computed Analysis (Writer Logic)
        const { sourceVideoCount, metrics } = calculateConsistencyMetrics(
          topVideos, // Cast to non-nullable array after check
          channelData.latestStats.subscriberCount
        );

        const now = new Date();
        const newLatestAnalysis: LatestAnalysis = {
          analyzedAt: now,
          subscriberCountAtAnalysis: channelData.latestStats.subscriberCount,
          sourceVideoCount: sourceVideoCount,
          metrics: metrics,
        };

        // STEP 3: Determine the NEW automatic status, but DON'T assign it yet
        const finalConsistencyPercentage =
          newLatestAnalysis.metrics[options.outlierMagnitude]
            .consistencyPercentage;
        const newAutomaticStatus =
          finalConsistencyPercentage >= consistencyThreshold
            ? "analyzed_promising"
            : "analyzed_low_consistency";

        // STEP 4: Decide which status to persist in the database
        if (!isPreservableStatus) {
          // If the original status was NOT a special one, overwrite it with the new automatic status.
          finalStatusToPersist = newAutomaticStatus;
        }
        // If the original status WAS a special one, finalStatusToPersist retains its original value.

        // STEP 5: Build and execute the database update
        const updatePayload: UpdateFilter<ChannelCache> = {
          $set: {
            latestAnalysis: newLatestAnalysis,
            status: finalStatusToPersist, // Use the carefully determined status
          },
        };

        if (historicalEntry) {
          updatePayload.$push = { analysisHistory: historicalEntry };
        }

        await nicheRepository.updateChannel(channelId, updatePayload);

        // STEP 6: Add the updated channel to the results if it's promising
        if (finalConsistencyPercentage >= consistencyThreshold) {
          promisingChannels.push({
            ...channelData, // Start with the original data
            latestAnalysis: newLatestAnalysis, // Add the new analysis data
            status: finalStatusToPersist, // Reflect the final persisted status
            analysisHistory: historicalEntry
              ? [...channelData.analysisHistory, historicalEntry]
              : channelData.analysisHistory, // Reflect the updated history
          });
        }
      } catch (error: unknown) {
        if (isQuotaError(error)) {
          console.error("YouTube API quota exceeded. Stopping analysis.");
          quotaExceeded = true;
          break;
        } else {
          console.error(
            `Failed to analyze channel ${channelId}: ${
              error instanceof Error ? error.message : String(error)
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
  } catch (error: unknown) {
    throw new Error(
      `Phase 3 failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
