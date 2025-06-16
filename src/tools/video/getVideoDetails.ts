import { z } from "zod";
import { youtube_v3 } from "googleapis";
import { CacheService } from "../../services/cache.service.js";
import { YoutubeService } from "../../services/youtube.service.js";
import { CACHE_TTLS, CACHE_COLLECTIONS } from "../../config/cache.config.js";
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
  videoIds: z.array(videoIdSchema),
  includeTags: z.boolean().optional().default(false),
  descriptionDetail: z
    .enum(["NONE", "SNIPPET", "LONG"])
    .optional()
    .default("NONE"),
});

export const getVideoDetailsConfig = {
  name: "getVideoDetails",
  description:
    "Get detailed information about multiple YouTube videos. Returns comprehensive data including video metadata, statistics, and content details. Use this when you need complete information about specific videos.",
  inputSchema: {
    videoIds: z
      .array(z.string())
      .describe("Array of YouTube video IDs to get details for"),
    includeTags: z
      .boolean()
      .optional()
      .describe(
        "Specify 'true' to include the video's 'tags' array in the response, which is useful for extracting niche keywords. The 'tags' are omitted by default to conserve tokens."
      ),
    descriptionDetail: z
      .enum(["NONE", "SNIPPET", "LONG"])
      .optional()
      .describe(
        "Controls video description detail to manage token cost. Options: 'NONE' (default, no text), 'SNIPPET' (a brief preview for broad scans), 'LONG' (a 500-char text for deep analysis of specific targets)."
      ),
  },
};

export const getVideoDetailsHandler = async (
  params: VideoDetailsParams,
  youtubeService: YoutubeService,
  cacheService?: CacheService
): Promise<CallToolResult> => {
  try {
    const validatedParams = getVideoDetailsSchema.parse(params);

    const videoPromises = validatedParams.videoIds.map(async (videoId) => {
      const transform = (fullVideoDetails: youtube_v3.Schema$Video | null) => {
        if (!fullVideoDetails) return { [videoId]: null };

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

        return { [videoId]: leanDetails };
      };

      if (!cacheService) {
        const fullDetails = await youtubeService.getVideo({
          videoId,
          parts: ["snippet", "statistics", "contentDetails"],
        });
        return transform(fullDetails);
      }

      const operation = () =>
        youtubeService.getVideo({
          videoId,
          parts: ["snippet", "statistics", "contentDetails"],
        });

      const fullDetails = await cacheService.getOrSet(
        videoId,
        operation,
        CACHE_TTLS.STANDARD, // Use named constant for TTL
        CACHE_COLLECTIONS.VIDEO_DETAILS, // Use named constant for collection
        validatedParams // Pass the original parameters for storage!
      );

      return transform(fullDetails);
    });

    const results = await Promise.all(videoPromises);
    const finalOutput = results.reduce(
      (acc, current) => ({ ...acc, ...current }),
      {} as Record<string, LeanVideoDetails | null>
    );
    return formatSuccess(finalOutput);
  } catch (error: any) {
    return formatError(error);
  }
};
