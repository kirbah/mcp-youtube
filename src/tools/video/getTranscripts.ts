import { z } from "zod";
import { YoutubeService } from "../../services/youtube.service.js";
import { formatError } from "../../utils/errorHandler.js";
import {
  formatSuccess,
  formatVideoMap,
} from "../../utils/responseFormatter.js";
import { videoIdSchema, languageSchema } from "../../utils/validation.js";
import type { TranscriptsParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getTranscriptsSchema = z.object({
  videoIds: z
    .array(videoIdSchema)
    .describe("Array of YouTube video IDs to get transcripts for"),
  lang: languageSchema
    .default("en")
    .describe(
      "Language code for transcripts (e.g., 'en', 'ko', 'es'). Defaults to environment setting or 'en'"
    ),
});

export const getTranscriptsConfig = {
  name: "getTranscripts",
  description:
    "Retrieves transcripts for multiple videos. Returns the text content of videos' captions, useful for accessibility and content analysis. Use this when you need the spoken content of multiple videos.",
  inputSchema: getTranscriptsSchema,
};

export const getTranscriptsHandler = async (
  params: TranscriptsParams,
  youtubeService: YoutubeService
): Promise<CallToolResult> => {
  try {
    const validatedParams = getTranscriptsSchema.parse(params);
    const { videoIds, lang } = validatedParams;

    const transcriptPromises = videoIds.map((videoId) =>
      youtubeService.getTranscript(videoId, lang)
    );
    const transcripts = await Promise.all(transcriptPromises);
    const result = formatVideoMap(videoIds, transcripts);

    return formatSuccess(result);
  } catch (error: any) {
    return formatError(error);
  }
};
