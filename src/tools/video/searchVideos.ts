import { z } from "zod";
import { youtube_v3 } from "googleapis";
import { CacheService } from "../../services/cache.service.js";
import { YoutubeService } from "../../services/youtube.service.js";
// Import our new config constants
import { CACHE_TTLS, CACHE_COLLECTIONS } from "../../config/cache.config.js";
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
  publishedAfter: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    .optional(),
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
    publishedAfter: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
      .optional()
      .describe("Filter content published after this date (ISO 8601 format)"),
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
      .describe("Filter by recency (overrides publishedAfter if set)"),
    regionCode: z
      .string()
      .length(2)
      .optional()
      .describe("2-letter country code to restrict results"),
  },
};

export const searchVideosHandler = async (
  params: SearchParams,
  youtubeService: YoutubeService,
  cacheService?: CacheService
): Promise<CallToolResult> => {
  try {
    const validatedParams = searchVideosSchema.parse(params);

    const transformAndFormat = (
      searchResults: youtube_v3.Schema$SearchResult[]
    ) => {
      const leanResults: LeanVideoSearchResult[] = searchResults.map(
        (result: youtube_v3.Schema$SearchResult) => ({
          videoId: result.id?.videoId ?? null,
          title: result.snippet?.title ?? null,
          descriptionSnippet: result.snippet?.description ?? null,
          channelId: result.snippet?.channelId ?? null,
          channelTitle: result.snippet?.channelTitle ?? null,
          publishedAt: result.snippet?.publishedAt ?? null,
        })
      );
      return leanResults;
    };

    if (!cacheService) {
      const rawResults = await youtubeService.searchVideos(validatedParams);
      const leanResults = transformAndFormat(rawResults);
      return formatSuccess(leanResults);
    }

    // With cache:
    const cacheKey = cacheService.createOperationKey(
      "searchVideos",
      validatedParams
    );

    const operation = async () => {
      // Operation fetches raw data and transforms it
      const rawResults = await youtubeService.searchVideos(validatedParams);
      return transformAndFormat(rawResults);
    };

    // --- Enhanced Caching Path ---
    const leanResults = await cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.STANDARD, // Use named constant for TTL
      CACHE_COLLECTIONS.VIDEO_SEARCHES, // Use named constant for collection
      validatedParams // <-- Pass the original parameters for storage!
    );

    return formatSuccess(leanResults);
  } catch (error: any) {
    return formatError(error);
  }
};
