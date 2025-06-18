import { z } from "zod";
import { youtube_v3 } from "googleapis";
import { YoutubeService } from "../../services/youtube.service.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { querySchema, maxResultsSchema } from "../../utils/validation.js";
import type { SearchParams } from "../../types/tools.js";
import type { LeanVideoSearchResult } from "../../types/youtube.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const searchVideosSchema = z.object({
  query: querySchema,
  maxResults: maxResultsSchema,
  order: z.enum(["relevance", "date", "viewCount"]).optional(),
  type: z.enum(["video", "channel"]).optional(),
  channelId: z.string().optional(),
  videoDuration: z.enum(["any", "short", "medium", "long"]).optional(),
  recency: z
    .enum([
      "any",
      "pastHour",
      "pastDay",
      "pastWeek",
      "pastMonth",
      "pastQuarter",
      "pastYear",
    ])
    .optional(),
  regionCode: z.string().length(2).optional(),
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
    order: z
      .enum(["relevance", "date", "viewCount"])
      .optional()
      .describe("Sort order for results (default: relevance)"),
    type: z
      .enum(["video", "channel"])
      .optional()
      .describe("Type of content to search for (default: video)"),
    channelId: z
      .string()
      .optional()
      .describe("Restrict search to specific channel ID"),
    videoDuration: z
      .enum(["any", "short", "medium", "long"])
      .optional()
      .describe(
        "Filter by video duration. 'any' (default): no duration filter. 'short': videos less than 4 minutes. 'medium': videos 4 to 20 minutes. 'long': videos longer than 20 minutes."
      ),
    recency: z
      .enum([
        "any",
        "pastHour",
        "pastDay",
        "pastWeek",
        "pastMonth",
        "pastQuarter",
        "pastYear",
      ])
      .optional()
      .describe("Filter by recency"),
    regionCode: z
      .string()
      .length(2)
      .optional()
      .describe("2-letter country code to restrict results"),
  },
};

export const searchVideosHandler = async (
  params: SearchParams,
  youtubeService: YoutubeService
): Promise<CallToolResult> => {
  try {
    const validatedParams = searchVideosSchema.parse(params);

    const rawResults = await youtubeService.searchVideos(validatedParams);

    const leanResults: LeanVideoSearchResult[] = rawResults.map(
      (result: youtube_v3.Schema$SearchResult) => ({
        videoId: result.id?.videoId ?? null,
        title: result.snippet?.title ?? null,
        descriptionSnippet: result.snippet?.description ?? null,
        channelId: result.snippet?.channelId ?? null,
        channelTitle: result.snippet?.channelTitle ?? null,
        publishedAt: result.snippet?.publishedAt ?? null,
      })
    );

    return formatSuccess(leanResults);
  } catch (error: any) {
    return formatError(error);
  }
};
