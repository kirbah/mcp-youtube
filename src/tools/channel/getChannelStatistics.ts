import { z } from "zod";
import { CacheService } from "../../services/cache.service.js";
import { YoutubeService } from "../../services/youtube.service.js";
import { CACHE_TTLS, CACHE_COLLECTIONS } from "../../config/cache.config.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { channelIdSchema } from "../../utils/validation.js";
import type { ChannelStatisticsParams } from "../../types/tools.js";
import type { LeanChannelStatistics } from "../../types/youtube.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getChannelStatisticsSchema = z.object({
  channelIds: z
    .array(channelIdSchema)
    .min(1, "Channel IDs array must contain at least 1 element(s)"),
});

export const getChannelStatisticsConfig = {
  name: "getChannelStatistics",
  description:
    "Retrieves statistics for multiple channels. Returns detailed metrics including subscriber count, view count, video count, and channel creation date for each channel. Use this when you need to analyze the performance and reach of multiple YouTube channels.",
  inputSchema: {
    channelIds: z
      .array(z.string())
      .describe("Array of YouTube channel IDs to get statistics for"),
  },
};

export const getChannelStatisticsHandler = async (
  params: ChannelStatisticsParams,
  youtubeService: YoutubeService,
  cacheService?: CacheService
): Promise<CallToolResult> => {
  try {
    const validatedParams = getChannelStatisticsSchema.parse(params);

    // No Cache Fallback
    if (!cacheService) {
      const statsPromises = validatedParams.channelIds.map((channelId) =>
        youtubeService.getChannelStatistics(channelId)
      );
      const statisticsResults = await Promise.all(statsPromises);
      return formatSuccess(statisticsResults);
    }

    // With Cache
    const statsPromises = validatedParams.channelIds.map((channelId) => {
      // For single-entity lookups, the entity ID itself is the best key.
      const cacheKey = channelId;

      const operation = () => youtubeService.getChannelStatistics(channelId);

      // No need to store 'params' here since the key is self-descriptive.
      return cacheService.getOrSet<LeanChannelStatistics>(
        cacheKey,
        operation,
        CACHE_TTLS.STANDARD,
        CACHE_COLLECTIONS.CHANNEL_STATS
      );
    });

    const statisticsResults = await Promise.all(statsPromises);
    return formatSuccess(statisticsResults);
  } catch (error: any) {
    return formatError(error);
  }
};
