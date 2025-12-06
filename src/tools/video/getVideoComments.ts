import { z } from "zod";
import { BaseTool } from "../base.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { formatSuccess } from "../../utils/responseFormatter.js";

// 2. Define the Input Schema (`getVideoCommentsSchema`)
export const getVideoCommentsSchema = z.object({
  videoId: z
    .string()
    .min(1)
    .describe("The 11-character ID of the YouTube video."),
  maxResults: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe(
      "Max number of top-level comments to return (1-100, default: 20)."
    ),
  order: z
    .enum(["relevance", "time"])
    .default("relevance")
    .describe(
      "Sort order for comments. Use 'relevance' (default) for most helpful or 'time' for newest."
    ),
  maxReplies: z
    .number()
    .min(0)
    .max(5)
    .default(0)
    .describe(
      "Max replies per comment to return (0-5, default: 0). Use 0 for best performance."
    ),
  commentDetail: z
    .enum(["SNIPPET", "FULL"])
    .default("SNIPPET")
    .describe(
      "Detail level for comment text. 'SNIPPET' (default, 200 chars) or 'FULL' (entire text)."
    ),
});

export class GetVideoCommentsTool extends BaseTool<
  typeof getVideoCommentsSchema
> {
  name = "getVideoComments";
  description =
    "Retrieves comments for a YouTube video. Allows sorting, limiting results, and fetching a small number of replies per comment.";
  schema = getVideoCommentsSchema;

  protected async executeImpl(
    params: z.infer<typeof getVideoCommentsSchema>
  ): Promise<CallToolResult> {
    // Call the service with the validated parameters
    const comments =
      await this.container.youtubeService.getVideoComments(params);

    // Use the standard success formatter
    return formatSuccess(comments);
  }
}
