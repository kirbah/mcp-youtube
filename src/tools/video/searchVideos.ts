import { z } from "zod";
import { youtube_v3 } from "googleapis";
import { BaseTool } from "../base.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { querySchema, maxResultsSchema } from "../../utils/validation.js";
import type { LeanVideoSearchResult } from "../../types/youtube.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const searchVideosSchema = z.object({
  query: querySchema.describe("Search query string to find videos"),
  maxResults: maxResultsSchema
    .optional()
    .default(10)
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
    .describe(
      "Filter by recency. Possible values: 'any', 'pastHour', 'pastDay', 'pastWeek', 'pastMonth', 'pastQuarter', 'pastYear'."
    ),
  regionCode: z
    .string()
    .length(2)
    .optional()
    .describe("2-letter country code to restrict results"),
});

export class SearchVideosTool extends BaseTool<typeof searchVideosSchema> {
  name = "searchVideos";
  description =
    "Universal search tool for YouTube content. Use this to find **videos** (default) or **channels**. To find a specific content creator, you MUST set `type` to 'channel'. Supports filtering by `recency` (e.g., 'pastWeek') and `videoDuration`. Returns `videoId` or `channelId` needed for other tools.";
  schema = searchVideosSchema;

  protected async executeImpl(
    params: z.infer<typeof searchVideosSchema>
  ): Promise<CallToolResult> {
    const rawResults = await this.container.youtubeService.searchVideos(params);

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
  }
}
