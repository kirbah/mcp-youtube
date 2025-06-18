import { z } from "zod";
import { YoutubeService } from "../../services/youtube.service.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { channelIdSchema, maxResultsSchema } from "../../utils/validation.js";
import type { ChannelParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getChannelTopVideosSchema = z.object({
  channelId: channelIdSchema,
  maxResults: maxResultsSchema.optional().default(10),
  includeTags: z.boolean().optional().default(false),
  descriptionDetail: z
    .enum(["NONE", "SNIPPET", "LONG"])
    .optional()
    .default("NONE"),
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
    includeTags: z
      .boolean()
      .optional()
      .describe(
        "Specify 'true' to include the video's 'tags' array in the response, which is useful for extracting niche keywords. The 'tags' are omitted by default to conserve tokens."
      ),
    descriptionDetail: z
      .enum(["NONE", "SNIPPET", "LONG"])
      .optional()
      .describe(
        "Controls video description detail to manage token cost. Options: 'NONE' (default, no text), 'SNIPPET' (a brief preview for broad scans), 'LONG' (a 500-char text for deep analysis of specific targets)."
      ),
  },
};

export const getChannelTopVideosHandler = async (
  params: ChannelParams,
  youtubeService: YoutubeService
): Promise<CallToolResult> => {
  try {
    const validatedParams = getChannelTopVideosSchema.parse(params);

    const topVideos = await youtubeService.getChannelTopVideos(validatedParams);

    return formatSuccess(topVideos);
  } catch (error: any) {
    return formatError(error);
  }
};
