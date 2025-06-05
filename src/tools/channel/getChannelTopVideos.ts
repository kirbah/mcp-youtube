import { z } from "zod";
import { VideoManagement } from "../../functions/videos.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { channelIdSchema, maxResultsSchema } from "../../utils/validation.js";
import type { ChannelParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getChannelTopVideosSchema = z.object({
  channelId: channelIdSchema,
  maxResults: maxResultsSchema,
});

export const getChannelTopVideosConfig = {
  name: "getChannelTopVideos",
  description:
    "Retrieves the top videos from a specific channel. Returns a list of the most viewed or popular videos from the channel, based on view count. Use this when you want to identify the most successful content from a channel.",
  inputSchema: {
    channelId: z.string().describe("YouTube channel ID to get top videos from"),
    maxResults: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("Maximum number of top videos to return (1-500, default: 10)"),
  },
};

export const getChannelTopVideosHandler = async (
  params: ChannelParams,
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = getChannelTopVideosSchema.parse(params);

    const topVideos = await videoManager.getChannelTopVideos({
      channelId: validatedParams.channelId,
      maxResults: validatedParams.maxResults,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(topVideos, null, 2),
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
