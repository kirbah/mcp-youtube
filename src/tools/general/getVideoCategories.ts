import { z } from "zod";
import { BaseTool } from "../base.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { regionCodeSchema } from "../../utils/validation.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getVideoCategoriesSchema = z.object({
  regionCode: regionCodeSchema
    .default("US")
    .describe(
      "Two-letter country code (e.g., 'US', 'GB', 'JP'). Defaults to 'US'"
    ),
});

export class GetVideoCategoriesTool extends BaseTool<
  typeof getVideoCategoriesSchema
> {
  name = "getVideoCategories";
  description =
    "Retrieves available video categories for a specific region. Returns a list of YouTube video categories with their IDs and titles that can be used for filtering trending videos or other category-specific operations. Different regions may have different available categories.";
  schema = getVideoCategoriesSchema;

  protected async executeImpl(
    params: z.infer<typeof getVideoCategoriesSchema>
  ): Promise<CallToolResult> {
    const { regionCode } = params;

    const categories = await this.container.youtubeService.getVideoCategories(
      regionCode
    );
    return formatSuccess(categories);
  }
}

