import { z } from "zod";
import { YoutubeService } from "../../services/youtube.service.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { videoIdSchema } from "../../utils/validation.js";
import {
  calculateLikeToViewRatio,
  calculateCommentToViewRatio,
} from "../../utils/engagementCalculator.js";
import { parseYouTubeNumber } from "../../utils/numberParser.js";
import { formatDescription } from "../../utils/textUtils.js";
import type { VideoDetailsParams } from "../../types/tools.js";
import type { LeanVideoDetails } from "../../types/youtube.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getVideoDetailsSchema = z.object({
  videoIds: z
    .array(videoIdSchema)
    .describe("Array of YouTube video IDs to get details for"),
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

export const getVideoDetailsConfig = {
  name: "getVideoDetails",
  description:
    "Get detailed information about multiple YouTube videos. Returns comprehensive data including video metadata, statistics, and content details. Use this when you need complete information about specific videos.",
  inputSchema: getVideoDetailsSchema,
};

export const getVideoDetailsHandler = async (
  params: VideoDetailsParams,
  youtubeService: YoutubeService
): Promise<CallToolResult> => {
  try {
    const validatedParams = getVideoDetailsSchema.parse(params);

    const videoPromises = validatedParams.videoIds.map(async (videoId) => {
      // 1. Call the service. Caching is now transparent and handled inside youtubeService.
      const fullVideoDetails = await youtubeService.getVideo({
        videoId,
        parts: ["snippet", "statistics", "contentDetails"],
      });

      // 2. The transformation logic remains here. It operates on the data
      //    whether it came from the cache or a live API call.
      if (!fullVideoDetails) {
        // Handle case where video is not found
        return { [videoId]: null };
      }

      // ... all your existing logic to parse counts and create the 'leanDetails' object ...
      const viewCount = parseYouTubeNumber(
        fullVideoDetails.statistics?.viewCount
      );
      const likeCount = parseYouTubeNumber(
        fullVideoDetails.statistics?.likeCount
      );
      const commentCount = parseYouTubeNumber(
        fullVideoDetails.statistics?.commentCount
      );

      const formattedDescription = formatDescription(
        fullVideoDetails.snippet?.description,
        validatedParams.descriptionDetail
      );

      const baseLeanDetails = {
        id: fullVideoDetails.id ?? null,
        title: fullVideoDetails.snippet?.title ?? null,
        channelId: fullVideoDetails.snippet?.channelId ?? null,
        channelTitle: fullVideoDetails.snippet?.channelTitle ?? null,
        publishedAt: fullVideoDetails.snippet?.publishedAt ?? null,
        duration: fullVideoDetails.contentDetails?.duration ?? null,
        viewCount: viewCount,
        likeCount: likeCount,
        commentCount: commentCount,
        likeToViewRatio: calculateLikeToViewRatio(viewCount, likeCount),
        commentToViewRatio: calculateCommentToViewRatio(
          viewCount,
          commentCount
        ),
        categoryId: fullVideoDetails.snippet?.categoryId ?? null,
        defaultLanguage: fullVideoDetails.snippet?.defaultLanguage ?? null,
      };

      const detailsWithDescription =
        formattedDescription !== undefined
          ? { ...baseLeanDetails, description: formattedDescription }
          : baseLeanDetails;

      const leanDetails: LeanVideoDetails = validatedParams.includeTags
        ? {
            ...detailsWithDescription,
            tags: fullVideoDetails.snippet?.tags ?? [],
          }
        : detailsWithDescription;

      // Return the final transformed object for this video
      return { [videoId]: leanDetails };
    });

    const results = await Promise.all(videoPromises);
    const finalOutput = results.reduce(
      (acc, current) => ({ ...acc, ...current }),
      {} as Record<string, LeanVideoDetails | null>
    );

    return formatSuccess(finalOutput);
  } catch (error: unknown) {
    return formatError(error);
  }
};
