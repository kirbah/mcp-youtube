import { z } from "zod";
import { VideoManagement } from "../../functions/videos.js";
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
  regionCode: regionCodeSchema,
  categoryId: categoryIdSchema,
  maxResults: maxResultsSchema,
});

export const getTrendingVideosConfig = {
  name: "getTrendingVideos",
  description:
    "Retrieves trending videos based on region and category. Returns a list of videos that are currently popular in the specified region and category. Use this when you want to discover what's trending in specific areas or categories. Available category IDs: 1 (Film & Animation), 2 (Autos & Vehicles), 10 (Music), 15 (Pets & Animals), 17 (Sports), 18 (Short Movies), 19 (Travel & Events), 20 (Gaming), 21 (Videoblogging), 22 (People & Blogs), 23 (Comedy), 24 (Entertainment), 25 (News & Politics), 26 (Howto & Style), 27 (Education), 28 (Science & Technology), 29 (Nonprofits & Activism), 30 (Movies), 31 (Anime/Animation), 32 (Action/Adventure), 33 (Classics), 34 (Comedy), 35 (Documentary), 36 (Drama), 37 (Family), 38 (Foreign), 39 (Horror), 40 (Sci-Fi/Fantasy), 41 (Thriller), 42 (Shorts), 43 (Shows), 44 (Trailers).",
  inputSchema: {
    regionCode: z
      .string()
      .length(2)
      .optional()
      .describe(
        "Two-letter country code (e.g., 'US', 'GB', 'JP'). Defaults to 'US'"
      ),
    categoryId: z
      .string()
      .optional()
      .describe("YouTube category ID to filter trending videos by category"),
    maxResults: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .describe(
        "Maximum number of trending videos to return (1-50, default: 10)"
      ),
  },
};

export const getTrendingVideosHandler = async (
  params: TrendingParams,
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = getTrendingVideosSchema.parse(params);

    const trendingVideos = await videoManager.getTrendingVideos({
      regionCode: validatedParams.regionCode,
      categoryId: validatedParams.categoryId,
      maxResults: validatedParams.maxResults,
    });

    return formatSuccess(trendingVideos);
  } catch (error: any) {
    return formatError(error);
  }
};
