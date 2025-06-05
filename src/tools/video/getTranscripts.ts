import { z } from "zod";
import { VideoManagement } from "../../functions/videos.js";
import { formatError } from "../../utils/errorHandler.js";
import {
  formatSuccess,
  formatVideoMap,
} from "../../utils/responseFormatter.js";
import { videoIdSchema, languageSchema } from "../../utils/validation.js";
import type { TranscriptsParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getTranscriptsSchema = z.object({
  videoIds: z.array(videoIdSchema),
  lang: languageSchema,
});

export const getTranscriptsConfig = {
  name: "getTranscripts",
  description:
    "Retrieves transcripts for multiple videos. Returns the text content of videos' captions, useful for accessibility and content analysis. Use this when you need the spoken content of multiple videos.",
  inputSchema: {
    videoIds: z
      .array(z.string())
      .describe("Array of YouTube video IDs to get transcripts for"),
    lang: z
      .string()
      .optional()
      .describe(
        "Language code for transcripts (e.g., 'en', 'ko', 'es'). Defaults to environment setting or 'en'"
      ),
  },
};

export const getTranscriptsHandler = async (
  params: TranscriptsParams,
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = getTranscriptsSchema.parse(params);

    const transcriptPromises = validatedParams.videoIds.map((videoId) =>
      videoManager.getTranscript(videoId, validatedParams.lang)
    );

    const transcripts = await Promise.all(transcriptPromises);
    const result = formatVideoMap(validatedParams.videoIds, transcripts);

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
            },
            null,
            2
          ),
        },
      ],
    };
  }
};
