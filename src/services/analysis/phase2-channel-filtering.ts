import { FindConsistentOutlierChannelsOptions } from "../../types/analyzer.types.js";
import { NicheRepository } from "./niche.repository.js";
import { YoutubeService } from "../../services/youtube.service.js";
import type { ChannelCache } from "../../types/niche.types.js";
import { youtube_v3 } from "googleapis";
import {
  applyStalnessHeuristic,
  calculateChannelAge,
  isValidChannelAge,
  calculateDerivedMetrics,
  MAX_SUBSCRIBER_CAP,
  MIN_SUBSCRIBER_THRESHOLD,
  MIN_AVG_VIEWS_THRESHOLD,
} from "./analysis.logic.js";

export const MIN_VIDEOS_FOR_ANALYSIS = 10;

export async function executeChannelPreFiltering(
  channelIds: string[],
  options: FindConsistentOutlierChannelsOptions,
  youtubeService: YoutubeService,
  nicheRepository: NicheRepository
): Promise<string[]> {
  try {
    const prospectsForPhase3: string[] = [];
    const needsStatsFetch: string[] = [];

    const cachedChannels = await nicheRepository.findChannelsByIds(channelIds);

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

    let freshChannelStats = new Map<string, youtube_v3.Schema$Channel>();
    if (needsStatsFetch.length > 0) {
      freshChannelStats =
        await youtubeService.batchFetchChannelStatistics(needsStatsFetch);
    }

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

        await nicheRepository.updateChannel(channelId, {
          $set: updatedChannel,
        });
        channelData = updatedChannel as ChannelCache;
      }

      if (!channelData) {
        continue;
      }

      if (channelData.latestStats.subscriberCount > MAX_SUBSCRIBER_CAP) {
        await nicheRepository.updateChannel(channelId, {
          $set: { status: "archived_too_large" },
        });
        continue;
      }

      if (channelData.latestStats.subscriberCount < MIN_SUBSCRIBER_THRESHOLD) {
        await nicheRepository.updateChannel(channelId, {
          $set: { status: "archived_too_small" },
        });
        continue;
      }

      if (channelData.latestStats.videoCount < MIN_VIDEOS_FOR_ANALYSIS) {
        await nicheRepository.updateChannel(channelId, {
          $set: { status: "archived_low_sample_size" },
        });
        continue;
      }

      const channelAge = calculateChannelAge(channelData.createdAt);
      const isValidAge = isValidChannelAge(channelAge, options.channelAge);

      if (!isValidAge) {
        await nicheRepository.updateChannel(channelId, {
          $set: { status: "archived_too_old" },
        });
        continue;
      }

      const metrics = calculateDerivedMetrics(channelData);
      const hasGoodPotential =
        metrics.historicalAvgViewsPerVideo >= MIN_AVG_VIEWS_THRESHOLD;

      if (!hasGoodPotential) {
        await nicheRepository.updateChannel(channelId, {
          $set: { status: "archived_low_potential" },
        });
        continue;
      }

      prospectsForPhase3.push(channelId);
    }

    return prospectsForPhase3;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Phase 2 failed: ${error.message}`);
    }
    throw new Error(`Phase 2 failed with an unknown error`);
  }
}
