import { z } from "zod";
import { VideoManagement } from "../../functions/videos.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { videoIdSchema } from "../../utils/validation.js";
import type { CompareVideosParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const compareVideosSchema = z.object({
  videoIds: z.array(videoIdSchema),
});

export const compareVideosConfig = {
  name: "compareVideos",
  description:
    "Compares multiple videos based on their statistics. Returns a comparison of view counts, like counts, comment counts, and other metrics for the specified videos. Use this when you want to analyze the performance of multiple videos side by side.",
  inputSchema: {
    videoIds: z
      .array(z.string())
      .describe("Array of YouTube video IDs to compare"),
  },
};

export const compareVideosHandler = async (
  params: CompareVideosParams,
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = compareVideosSchema.parse(params);

    const comparison = await videoManager.compareVideos({
      videoIds: validatedParams.videoIds,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(comparison, null, 2),
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
