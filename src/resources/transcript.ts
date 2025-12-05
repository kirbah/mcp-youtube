import { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BaseResource } from "./base.js";

export class TranscriptResource extends BaseResource {
  uri = new ResourceTemplate("youtube://transcript/{videoId}/{language_code}", {
    list: undefined,
  });
  name = "YouTube Transcript";
  mimeType = "application/json";
  description =
    "Get the transcript for a YouTube video. Use URI format: youtube://transcript/{videoId}/{language_code}";

  protected async readImpl(
    uri: URL,
    variables?: unknown
  ): Promise<ReadResourceResult> {
    const { transcriptService } = this.container;
    const { videoId, language_code } = variables as {
      videoId: string;
      language_code?: string;
    };

    if (!videoId) {
      throw new Error("Missing videoId in URI variables");
    }

    // Default to 'en' if language_code is not provided or empty
    const lang = language_code || "en";

    const result = await transcriptService.getTranscriptSegments(
      videoId,
      lang,
      "full_text"
    );

    if (!result || !("transcript" in result)) {
      throw new Error(
        `Transcript not found for video ${videoId} in language ${lang}`
      );
    }

    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: this.mimeType,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
}
