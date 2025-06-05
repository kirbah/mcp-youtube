import { z } from "zod";
import { VideoManagement } from "../../functions/videos.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { querySchema, maxResultsSchema } from "../../utils/validation.js";
import type { SearchParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const searchVideosSchema = z.object({
  query: querySchema,
  maxResults: maxResultsSchema,
});

export const searchVideosConfig = {
  name: "searchVideos",
  description:
    "Searches for videos based on a query string. Returns a list of videos matching the search criteria, including titles, descriptions, and metadata. Use this when you need to find videos related to specific topics or keywords.",
  inputSchema: {
    query: z.string().describe("Search query string to find videos"),
    maxResults: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("Maximum number of results to return (1-500, default: 10)"),
  },
};

export const searchVideosHandler = async (
  params: SearchParams,
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = searchVideosSchema.parse(params);

    const searchResults = await videoManager.searchVideos({
      query: validatedParams.query,
      maxResults: validatedParams.maxResults,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(searchResults, null, 2),
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
