import { z } from "zod";
import { CacheService } from "../../services/cache.service.js";
import { YoutubeService } from "../../services/youtube.service.js";
import { CACHE_TTLS, CACHE_COLLECTIONS } from "../../config/cache.config.js";
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
  lang: languageSchema.default("en"),
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
  youtubeService: YoutubeService,
  cacheService?: CacheService
): Promise<CallToolResult> => {
  try {
    const validatedParams = getTranscriptsSchema.parse(params);
    const { videoIds, lang = "en" } = validatedParams;

    // --- No Cache Fallback ---
    if (!cacheService) {
      const transcriptPromises = videoIds.map((videoId) =>
        youtubeService.getTranscript(videoId, lang)
      );
      const transcripts = await Promise.all(transcriptPromises);
      const result = formatVideoMap(videoIds, transcripts);
      return formatSuccess(result);
    }

    // --- With Cache ---
    const transcriptPromises = videoIds.map((videoId) => {
      // 1. Create a key based on both videoId and language
      const cacheKey = cacheService.createOperationKey("getTranscript", {
        videoId,
        lang,
      });

      // 2. Define the operation
      const operation = () => youtubeService.getTranscript(videoId, lang);

      // 3. Use getOrSet and store the operation params for debuggability
      return cacheService.getOrSet(
        cacheKey,
        operation,
        CACHE_TTLS.STATIC,
        CACHE_COLLECTIONS.TRANSCRIPTS,
        { videoId, lang }
      );
    });

    const transcripts = await Promise.all(transcriptPromises);
    const result = formatVideoMap(videoIds, transcripts);

    return formatSuccess(result);
  } catch (error: any) {
    return formatError(error);
  }
};
