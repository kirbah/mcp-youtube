import { z } from "zod";
import { VideoManagement } from "../../functions/videos.js";
import { formatError } from "../../utils/errorHandler.js";
import {
  formatSuccess,
  formatVideoMap,
} from "../../utils/responseFormatter.js";
import { videoIdSchema } from "../../utils/validation.js";
import type { VideoDetailsParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getVideoDetailsSchema = z.object({
  videoIds: z.array(videoIdSchema),
});

export const getVideoDetailsConfig = {
  name: "getVideoDetails",
  description:
    "Get detailed information about multiple YouTube videos. Returns comprehensive data including video metadata, statistics, and content details. Use this when you need complete information about specific videos.",
  inputSchema: {
    videoIds: z
      .array(z.string())
      .describe("Array of YouTube video IDs to get details for"),
  },
};

export const getVideoDetailsHandler = async (
  params: VideoDetailsParams,
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = getVideoDetailsSchema.parse(params);

    const videoPromises = validatedParams.videoIds.map((videoId) =>
      videoManager.getVideo({
        videoId,
        parts: ["snippet", "statistics"],
      })
    );

    const videoDetailsList = await Promise.all(videoPromises);
    const result = formatVideoMap(validatedParams.videoIds, videoDetailsList);

    return formatSuccess(result);
  } catch (error: any) {
    return formatError(error);
  }
};
