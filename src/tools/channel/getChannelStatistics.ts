import { z } from "zod";
import { YoutubeService } from "../../services/youtube.service.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { channelIdSchema } from "../../utils/validation.js";
import type { ChannelStatisticsParams } from "../../types/tools.js";
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
  youtubeService: YoutubeService
): Promise<CallToolResult> => {
  try {
    const validatedParams = getChannelStatisticsSchema.parse(params);

    const statsPromises = validatedParams.channelIds.map((channelId) =>
      youtubeService.getChannelStatistics(channelId)
    );

    const statisticsResults = await Promise.all(statsPromises);
    return formatSuccess(statisticsResults);
  } catch (error: any) {
    return formatError(error);
  }
};
