import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { YoutubeService } from "../../services/youtube.service.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { formatError } from "../../utils/errorHandler.js";

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
    // First, validate the parameters (this is the standard pattern)
    const validatedParams = getVideoCommentsSchema.parse(params);

    // Call the service with the validated parameters
    const comments = await youtubeService.getVideoComments(validatedParams);

    // Use the standard success formatter
    return formatSuccess(comments);
  } catch (error: any) {
    // Use the standard error formatter
    return formatError(error);
  }
}
