import { z } from "zod";
import { YoutubeService } from "../../services/youtube.service.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import {
  regionCodeSchema,
  categoryIdSchema,
  maxResultsSchema,
} from "../../utils/validation.js";
import type { TrendingParams } from "../../types/tools.js";
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

export const getTrendingVideosConfig = {
  name: "getTrendingVideos",
  description:
    "Retrieves trending videos based on region and category. Returns a list of videos that are currently popular in the specified region and category. Use this when you want to discover what's trending in specific areas or categories. To get available category IDs and their names, use the getVideoCategories tool first.",
  inputSchema: getTrendingVideosSchema,
};

export const getTrendingVideosHandler = async (
  params: TrendingParams,
  youtubeService: YoutubeService
): Promise<CallToolResult> => {
  try {
    const validatedParams = getTrendingVideosSchema.parse(params);

    const trendingVideos =
      await youtubeService.getTrendingVideos(validatedParams);

    return formatSuccess(trendingVideos);
  } catch (error: unknown) {
    return formatError(error);
  }
};
