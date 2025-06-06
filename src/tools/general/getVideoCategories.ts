import { z } from "zod";
import { VideoManagement } from "../../functions/videos.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { regionCodeSchema } from "../../utils/validation.js";
import type { VideoCategoriesParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getVideoCategoriesSchema = z.object({
  regionCode: regionCodeSchema,
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
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = getVideoCategoriesSchema.parse(params);

    const categories = await videoManager.getVideoCategories(
      validatedParams.regionCode
    );

    return formatSuccess(categories);
  } catch (error: any) {
    return formatError(error);
  }
};
