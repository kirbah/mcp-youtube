import { z } from "zod";
import { VideoManagement } from "../../functions/videos.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { videoIdSchema, maxResultsSchema } from "../../utils/validation.js";
import type { RelatedVideosParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getRelatedVideosSchema = z.object({
  videoId: videoIdSchema,
  maxResults: maxResultsSchema,
});

export const getRelatedVideosConfig = {
  name: "getRelatedVideos",
  description:
    "Retrieves related videos for a specific video. Returns a list of videos that are similar or related to the specified video, based on YouTube's recommendation algorithm. Use this when you want to discover content similar to a particular video.",
  inputSchema: {
    videoId: z.string().describe("YouTube video ID to find related videos for"),
    maxResults: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe(
        "Maximum number of related videos to return (1-500, default: 10)"
      ),
  },
};

export const getRelatedVideosHandler = async (
  params: RelatedVideosParams,
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = getRelatedVideosSchema.parse(params);

    const relatedVideos = await videoManager.getRelatedVideos(
      validatedParams.videoId,
      validatedParams.maxResults
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(relatedVideos, null, 2),
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
