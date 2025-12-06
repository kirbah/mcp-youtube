import { z } from "zod";
import { BaseTool } from "../base.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import {
  regionCodeSchema,
  categoryIdSchema,
  maxResultsSchema,
} from "../../utils/validation.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getTrendingVideosSchema = z.object({
  regionCode: regionCodeSchema
    .default("US")
    .describe(
      "Two-letter country code (e.g., 'US', 'GB', 'JP'). Defaults to 'US'"
    ),
  categoryId: categoryIdSchema.describe(
    "YouTube category ID to filter trending videos by category. Use getVideoCategories tool to get available category IDs."
  ), // categoryId is optional and has no default
  maxResults: maxResultsSchema
    .default(10)
    .describe(
      "Maximum number of trending videos to return (1-500, default: 10)"
    ),
});

export class GetTrendingVideosTool extends BaseTool<
  typeof getTrendingVideosSchema
> {
  name = "getTrendingVideos";
  description =
    "Retrieves trending videos based on region and category. Returns a list of videos that are currently popular in the specified region and category. Use this when you want to discover what's trending in specific areas or categories. To get available category IDs and their names, use the getVideoCategories tool first.";
  schema = getTrendingVideosSchema;

  protected async executeImpl(
    params: z.infer<typeof getTrendingVideosSchema>
  ): Promise<CallToolResult> {
    const trendingVideos = await this.container.youtubeService.getTrendingVideos(
      params
    );

    return formatSuccess(trendingVideos);
  }
}

