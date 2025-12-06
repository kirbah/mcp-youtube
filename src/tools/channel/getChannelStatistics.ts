import { z } from "zod";
import { BaseTool } from "../base.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { channelIdSchema } from "../../utils/validation.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getChannelStatisticsSchema = z.object({
  channelIds: z
    .array(channelIdSchema)
    .min(1, "Channel IDs array must contain at least 1 element(s)")
    .describe("Array of YouTube channel IDs to get statistics for"),
});

export class GetChannelStatisticsTool extends BaseTool<
  typeof getChannelStatisticsSchema
> {
  name = "getChannelStatistics";
  description =
    "Retrieves statistics for multiple channels. Returns detailed metrics including subscriber count, view count, video count, and channel creation date for each channel. Use this when you need to analyze the performance and reach of multiple YouTube channels.";
  schema = getChannelStatisticsSchema;

  protected async executeImpl(
    params: z.infer<typeof getChannelStatisticsSchema>
  ): Promise<CallToolResult> {
    const statsPromises = params.channelIds.map((channelId) =>
      this.container.youtubeService.getChannelStatistics(channelId)
    );

    const statisticsResults = await Promise.all(statsPromises);
    return formatSuccess(statisticsResults);
  }
}
