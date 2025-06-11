import { FindConsistentOutlierChannelsOptions } from "../../types/analyzer.types.js";
import { CacheService } from "../cache.service.js";
import { VideoManagement } from "../../functions/videos.js";
import { ChannelCache } from "./analysis.types.js";
import {
  applyStalnessHeuristic,
  calculateChannelAge,
  isValidChannelAge,
  calculateDerivedMetrics,
  MAX_SUBSCRIBER_CAP,
  MIN_AVG_VIEWS_THRESHOLD,
} from "./analysis.logic.js";

export async function executeChannelPreFiltering(
  channelIds: string[],
  options: FindConsistentOutlierChannelsOptions,
  cacheService: CacheService,
  videoManagement: VideoManagement
): Promise<string[]> {
  try {
    const prospectsForPhase3: string[] = [];
    const needsStatsFetch: string[] = [];

    const cachedChannels = await cacheService.findChannelsByIds(channelIds);

    const cachedChannelMap = new Map<string, ChannelCache>();
    for (const channel of cachedChannels) {
      cachedChannelMap.set(channel._id, channel);
    }

    for (const channelId of channelIds) {
      const cachedChannel = cachedChannelMap.get(channelId);

      if (!cachedChannel) {
        needsStatsFetch.push(channelId);
      } else {
        const isStale = applyStalnessHeuristic(
          cachedChannel,
          options.channelAge
        );
        if (isStale) {
          needsStatsFetch.push(channelId);
        }
      }
    }

    const freshChannelStats = await videoManagement.batchFetchChannelStatistics(
      needsStatsFetch
    );

    for (const channelId of channelIds) {
      let channelData = cachedChannelMap.get(channelId);
      const freshStats = freshChannelStats.get(channelId);

      if (freshStats) {
        const now = new Date();
        const channelCreatedAt = freshStats.snippet?.publishedAt
          ? new Date(freshStats.snippet.publishedAt)
          : now;

        const updatedChannel: Partial<ChannelCache> = {
          _id: channelId,
          channelTitle: freshStats.snippet?.title || "Unknown Channel",
          createdAt: channelCreatedAt,
          status: channelData?.status || "candidate",
          latestStats: {
            fetchedAt: now,
            subscriberCount: parseInt(
              freshStats.statistics?.subscriberCount || "0"
            ),
            videoCount: parseInt(freshStats.statistics?.videoCount || "0"),
            viewCount: parseInt(freshStats.statistics?.viewCount || "0"),
          },
          latestAnalysis: channelData?.latestAnalysis,
          analysisHistory: channelData?.analysisHistory || [],
        };

        await cacheService.updateChannel(channelId, updatedChannel);
        channelData = updatedChannel as ChannelCache;
      }

      if (!channelData) {
        continue;
      }

      if (channelData.latestStats.subscriberCount > MAX_SUBSCRIBER_CAP) {
        await cacheService.updateChannel(channelId, {
          status: "archived_too_large",
        });
        continue;
      }

      const channelAge = calculateChannelAge(channelData.createdAt);
      const isValidAge = isValidChannelAge(channelAge, options.channelAge);

      if (!isValidAge) {
        await cacheService.updateChannel(channelId, {
          status: "archived_too_old",
        });
        continue;
      }

      const metrics = calculateDerivedMetrics({
        statistics: channelData.latestStats,
      });
      const hasGoodPotential =
        metrics.historicalAvgViewsPerVideo >= MIN_AVG_VIEWS_THRESHOLD;

      if (!hasGoodPotential) {
        await cacheService.updateChannel(channelId, {
          status: "archived_low_potential",
        });
        continue;
      }

      prospectsForPhase3.push(channelId);
    }

    return prospectsForPhase3;
  } catch (error: any) {
    throw new Error(`Phase 2 failed: ${error.message}`);
  }
}
