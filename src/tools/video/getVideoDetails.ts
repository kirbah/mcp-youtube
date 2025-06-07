import { z } from "zod";
import { youtube_v3 } from "googleapis";
import { VideoManagement } from "../../functions/videos.js";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { videoIdSchema } from "../../utils/validation.js";
import {
  calculateLikeToViewRatio,
  calculateCommentToViewRatio,
} from "../../utils/engagementCalculator.js";
import { parseYouTubeNumber } from "../../utils/numberParser.js";
import type { VideoDetailsParams } from "../../types/tools.js";
import type { LeanVideoDetails } from "../../types/youtube.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const getVideoDetailsSchema = z.object({
  videoIds: z.array(videoIdSchema),
});

export const getVideoDetailsConfig = {
  name: "getVideoDetails",
  description:
    "Get detailed information about multiple YouTube videos. Returns comprehensive data including video metadata, statistics, and content details. Use this when you need complete information about specific videos.",
  inputSchema: {
    videoIds: z
      .array(z.string())
      .describe("Array of YouTube video IDs to get details for"),
  },
};

const truncateDescription = (
  description: string | null | undefined,
  maxLength: number = 1000
): string | null => {
  if (!description) return null;
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + "...";
};

export const getVideoDetailsHandler = async (
  params: VideoDetailsParams,
  videoManager: VideoManagement
): Promise<CallToolResult> => {
  try {
    const validatedParams = getVideoDetailsSchema.parse(params);

    const videoPromises = validatedParams.videoIds.map(async (videoId) => {
      try {
        const fullVideoDetails: youtube_v3.Schema$Video | null = // Allow null
          await videoManager.getVideo({
            videoId,
            parts: ["snippet", "statistics", "contentDetails"],
          });

        if (!fullVideoDetails) {
          console.error(
            `Video details not found for ID: ${videoId}`,
            "Returned null from videoManager.getVideo"
          );
          return { [videoId]: null };
        }

        const viewCount = parseYouTubeNumber(
          fullVideoDetails.statistics?.viewCount
        );
        const likeCount = parseYouTubeNumber(
          fullVideoDetails.statistics?.likeCount
        );
        const commentCount = parseYouTubeNumber(
          fullVideoDetails.statistics?.commentCount
        );

        const leanDetails: LeanVideoDetails = {
          id: fullVideoDetails.id ?? null,
          title: fullVideoDetails.snippet?.title ?? null,
          description:
            truncateDescription(fullVideoDetails.snippet?.description) ?? null,
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
          tags: fullVideoDetails.snippet?.tags ?? [],
          categoryId: fullVideoDetails.snippet?.categoryId ?? null,
          defaultLanguage: fullVideoDetails.snippet?.defaultLanguage ?? null,
        };

        return { [videoId]: leanDetails };
      } catch (error: any) {
        console.error(
          `Video details not found for ID: ${videoId}`,
          error.message
        );
        return { [videoId]: null };
      }
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
