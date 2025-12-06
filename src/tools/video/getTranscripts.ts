import { z } from "zod";
import { BaseTool } from "../base.js";
import { formatError } from "../../utils/errorHandler.js";
import {
  formatSuccess,
  formatVideoMap,
} from "../../utils/responseFormatter.js";
import { videoIdSchema, languageSchema } from "../../utils/validation.js";
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
  format: z
    .enum(["full_text", "key_segments"])
    .default("key_segments")
    .describe(
      "The desired transcript format. " +
      "'full_text': Returns the entire transcript as a single string. " +
      "'key_segments': (Default) Returns only the video's intro hook and final call to action."
    ),
});

export class GetTranscriptsTool extends BaseTool<typeof getTranscriptsSchema> {
  name = "getTranscripts";
  description =
    "Retrieves specific, meaningful segments of a video's transcript. By default, it returns the intro 'hook' and the final 'outro' or call to action. It can also return the full transcript text. Use this to efficiently analyze a video's key messaging.";
  schema = getTranscriptsSchema;

  protected async executeImpl(
    params: z.infer<typeof getTranscriptsSchema>
  ): Promise<CallToolResult> {
    const { videoIds, lang, format } = params;

    const transcriptPromises = videoIds.map((videoId) =>
      this.container.transcriptService.getTranscriptSegments(
        videoId,
        lang,
        format
      )
    );
    const transcripts = await Promise.all(transcriptPromises);
    const result = formatVideoMap(videoIds, transcripts);

    return formatSuccess(result);
  }
}

