import { z } from "zod";
import { CacheService } from "../../services/cache.service.js";
import { YoutubeService } from "../../services/youtube.service.js";
import { CACHE_TTLS, CACHE_COLLECTIONS } from "../../config/cache.config.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { regionCodeSchema } from "../../utils/validation.js";
import type { VideoCategoriesParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getVideoCategoriesSchema = z.object({
  regionCode: regionCodeSchema.default("US"),
});

export const getVideoCategoriesConfig = {
  name: "getVideoCategories",
  description:
    "Retrieves available video categories for a specific region. Returns a list of YouTube video categories with their IDs and titles that can be used for filtering trending videos or other category-specific operations. Different regions may have different available categories.",
  inputSchema: {
    regionCode: z
      .string()
      .length(2)
      .optional()
      .describe(
        "Two-letter country code (e.g., 'US', 'GB', 'JP'). Defaults to 'US'"
      ),
  },
};

export const getVideoCategoriesHandler = async (
  params: VideoCategoriesParams,
  youtubeService: YoutubeService,
  cacheService?: CacheService
): Promise<CallToolResult> => {
  try {
    const validatedParams = getVideoCategoriesSchema.parse(params);
    const { regionCode = "US" } = validatedParams;

    if (!cacheService) {
      const categories = await youtubeService.getVideoCategories(regionCode);
      return formatSuccess(categories);
    }

    // With cache:
    const cacheKey = cacheService.createOperationKey("getVideoCategories", {
      regionCode,
    });
    const operation = () => youtubeService.getVideoCategories(regionCode);

    const categories = await cacheService.getOrSet(
      cacheKey,
      operation,
      CACHE_TTLS.STATIC, // Use named constant for TTL
      CACHE_COLLECTIONS.VIDEO_CATEGORIES, // Use named constant for collection
      validatedParams // Pass the original parameters for storage!
    );

    return formatSuccess(categories);
  } catch (error: any) {
    return formatError(error);
  }
};
