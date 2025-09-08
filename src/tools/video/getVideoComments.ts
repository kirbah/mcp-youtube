import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { YoutubeService } from "../../services/youtube.service.js";

// 2. Define the Input Schema (`getVideoCommentsSchema`)
export const getVideoCommentsSchema = z.object({
  videoId: z
    .string()
    .min(1)
    .describe(
      'The unique 11-character ID of the YouTube video from which to retrieve comments (e.g., "dQw4w9WgXcQ").'
    ),
  maxResults: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe(
      "The maximum number of top-level comments to return. Value must be between 1 and 100."
    ),
  order: z
    .enum(["relevance", "time"])
    .default("relevance")
    .describe(
      "The sorting order for comments. Valid options are: - 'relevance': Sorts by engagement and quality (most helpful comments first). - 'time': Sorts by submission date (newest comments first)."
    ),
  maxReplies: z
    .number()
    .min(0)
    .max(5)
    .default(0)
    .describe(
      "The maximum number of replies to return for each top-level comment. Value must be between 0 and 5. Fetching replies consumes additional API quota; a value of 0 (the default) is the most efficient as it excludes all replies."
    ),
  commentDetail: z
    .enum(["SNIPPET", "FULL"])
    .default("SNIPPET")
    .describe(
      "Controls the length of the returned comment text to manage token cost. Valid options are: - 'SNIPPET': (Default) Truncates the comment text to a maximum of 200 characters. - 'FULL': Returns the entire, untruncated comment text."
    ),
});

// 3. Define the Tool Configuration (`getVideoCommentsConfig`)
export const getVideoCommentsConfig = {
  name: "getVideoComments",
  description:
    "Retrieves top-level comments for a specific YouTube video, with options to sort, limit results, and include a specified number of replies. This tool is optimized to return lean, structured comment data to minimize token usage and is ideal for analyzing audience sentiment, identifying key topics of discussion, or extracting feedback.",
  inputSchema: getVideoCommentsSchema,
  inject: ["youtubeService"],
};

// 4. Create the Placeholder Tool Handler (`getVideoCommentsHandler`)
export async function getVideoCommentsHandler(
  params: z.infer<typeof getVideoCommentsSchema>,
  youtubeService: YoutubeService
): Promise<CallToolResult> {
  // Placeholder implementation
  console.log("getVideoCommentsHandler called with params:", params);
  return {
    content: [
      { type: "text", text: "getVideoComments tool is not yet implemented." },
    ],
    output: {
      message: "getVideoComments tool is not yet implemented.",
      params,
    },
    displayForUser: true,
  };
}
