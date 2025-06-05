import { z } from "zod";
import { VideoManagement } from "../../functions/videos.js";
import { formatError } from "../../utils/errorHandler.js";
import {
  formatSuccess,
  formatVideoMap,
} from "../../utils/responseFormatter.js";
import { videoIdSchema } from "../../utils/validation.js";
import type { VideoEngagementRatiosParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getVideoEngagementRatioSchema = z.object({
  videoIds: z.array(videoIdSchema),
});

export const getVideoEngagementRatioConfig = {
  name: "getVideoEngagementRatio",
  description:
    "Calculates the engagement ratio for multiple videos. Returns metrics such as view count, like count, comment count, and the calculated engagement ratio for each video. Use this when you want to measure the audience interaction with videos.",
  inputSchema: {
    videoIds: z
      .array(z.string())
      .describe(
        "Array of YouTube video IDs to calculate engagement ratios for"
      ),
  },
};

export const getVideoEngagementRatioHandler = async (
  params: VideoEngagementRatiosParams,
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = getVideoEngagementRatioSchema.parse(params);

    const engagementPromises = validatedParams.videoIds.map((videoId) =>
      videoManager.getVideoEngagementRatio(videoId)
    );

    const engagementResults = await Promise.all(engagementPromises);
    const result = formatVideoMap(validatedParams.videoIds, engagementResults);

    return formatSuccess(result);
  } catch (error: any) {
    return formatError(error);
  }
};
