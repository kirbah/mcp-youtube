import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { YoutubeService } from "../../services/youtube.service.js";

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

// 3. Define the Tool Configuration (`getVideoCommentsConfig`)
export const getVideoCommentsConfig = {
  name: "getVideoComments",
  description:
    "Retrieves comments for a YouTube video. Allows sorting, limiting results, and fetching a small number of replies per comment.",
  inputSchema: getVideoCommentsSchema,
  inject: ["youtubeService"],
};

// 4. Create the Placeholder Tool Handler (`getVideoCommentsHandler`)
export async function getVideoCommentsHandler(
  params: z.infer<typeof getVideoCommentsSchema>,
  youtubeService: YoutubeService
): Promise<CallToolResult> {
  try {
    const comments = await youtubeService.getVideoComments(params);
    return {
      success: true,
      content: [{ type: "text", text: JSON.stringify(comments, null, 2) }],
      output: {
        message: "Successfully retrieved video comments.",
        data: comments,
      },
      displayForUser: true,
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      output: {
        message: `Error: ${errorMessage}`,
      },
      displayForUser: true,
    };
  }
}
