import { z } from "zod";
import { BaseTool } from "../base.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { channelIdSchema, maxResultsSchema } from "../../utils/validation.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getChannelTopVideosSchema = z.object({
  channelId: channelIdSchema.describe(
    "YouTube channel ID to get top videos from"
  ),
  maxResults: maxResultsSchema
    .optional()
    .default(10)
    .describe("Maximum number of top videos to return (1-500, default: 10)"),
  includeTags: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Specify 'true' to include the video's 'tags' array in the response, which is useful for extracting niche keywords. The 'tags' are omitted by default to conserve tokens."
    ),
  descriptionDetail: z
    .enum(["NONE", "SNIPPET", "LONG"])
    .optional()
    .default("NONE")
    .describe(
      "Controls video description detail to manage token cost. Options: 'NONE' (default, no text), 'SNIPPET' (a brief preview for broad scans), 'LONG' (a 500-char text for deep analysis of specific targets)."
    ),
});

export class GetChannelTopVideosTool extends BaseTool<
  typeof getChannelTopVideosSchema
> {
  name = "getChannelTopVideos";
  description =
    "Retrieves a channel's most popular videos. CRITICAL: Requires a valid `channelId` (starting with 'UC...'), NOT a channel handle or name. Use `searchVideos` (type='channel') first to find the `channelId` if you only have a name.";
  schema = getChannelTopVideosSchema;

  protected async executeImpl(
    params: z.infer<typeof getChannelTopVideosSchema>
  ): Promise<CallToolResult> {
    const topVideos =
      await this.container.youtubeService.getChannelTopVideos(params);

    return formatSuccess(topVideos);
  }
}
