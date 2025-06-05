import { z } from "zod";
import { VideoManagement } from "../../functions/videos.js";
import { formatError } from "../../utils/errorHandler.js";
import {
  formatSuccess,
  formatChannelMap,
} from "../../utils/responseFormatter.js";
import { channelIdSchema } from "../../utils/validation.js";
import type { ChannelStatisticsParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getChannelStatisticsSchema = z.object({
  channelIds: z.array(channelIdSchema),
});

export const getChannelStatisticsConfig = {
  name: "getChannelStatistics",
  description:
    "Retrieves statistics for multiple channels. Returns detailed metrics including subscriber count, view count, and video count for each channel. Use this when you need to analyze the performance and reach of multiple YouTube channels.",
  inputSchema: {
    channelIds: z
      .array(z.string())
      .describe("Array of YouTube channel IDs to get statistics for"),
  },
};

export const getChannelStatisticsHandler = async (
  params: ChannelStatisticsParams,
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = getChannelStatisticsSchema.parse(params);

    const statisticsPromises = validatedParams.channelIds.map((channelId) =>
      videoManager.getChannelStatistics(channelId)
    );

    const statisticsResults = await Promise.all(statisticsPromises);
    const result = formatChannelMap(
      validatedParams.channelIds,
      statisticsResults
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error.message || "An unknown error occurred",
              details: error.response?.data,
            },
            null,
            2
          ),
        },
      ],
    };
  }
};
