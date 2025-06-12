import { youtube_v3 } from "googleapis";
import { ChannelCache } from "./analysis.types.js";

export const STALENESS_DAYS_NEW = 14;
export const STALENESS_DAYS_ESTABLISHED = 45;
export const MIN_AVG_VIEWS_THRESHOLD = 1000;
export const MAX_SUBSCRIBER_CAP = 100_000;
export const MIN_OUTLIER_VIEW_COUNT = 1000;
export const MIN_VIDEO_DURATION_SECONDS = 180;

export function isQuotaError(error: any): boolean {
  if (error && error.code === 403) {
    return true;
  }
  if (error && error.errors && Array.isArray(error.errors)) {
    return error.errors.some((err: any) => err.reason === "quotaExceeded");
  }
  return false;
}

export function calculateChannelAgePublishedAfter(
  channelAge: "NEW" | "ESTABLISHED"
): string {
  const targetDate = new Date(); // Start with current date
  const monthsToSubtract = channelAge === "NEW" ? 6 : 24;

  // Subtract months
  targetDate.setMonth(targetDate.getMonth() - monthsToSubtract);

  // Normalize the date to the beginning of the day (UTC)
  // This is crucial for caching: by setting hours, minutes, seconds, and milliseconds to 0,
  // we ensure that the 'publishedAfter' timestamp is consistent for any given day,
  // leading to cache hits for repeated searches within the same 24-hour period.
  targetDate.setUTCHours(0, 0, 0, 0);

  return targetDate.toISOString();
}

export function getOutlierMultiplier(
  outlierMagnitude: "STANDARD" | "STRONG"
): number {
  return outlierMagnitude === "STANDARD" ? 1 : 3;
}

export function getConsistencyThreshold(
  consistencyLevel: "MODERATE" | "HIGH"
): number {
  return consistencyLevel === "MODERATE" ? 30 : 50;
}

export function applyStalnessHeuristic(
  channel: ChannelCache,
  channelAge: "NEW" | "ESTABLISHED"
): boolean {
  if (!channel.latestAnalysis) {
    return true;
  }

  const now = new Date();
  const analysisAge =
    now.getTime() - channel.latestAnalysis.analyzedAt.getTime();
  const staleDays =
    channelAge === "NEW" ? STALENESS_DAYS_NEW : STALENESS_DAYS_ESTABLISHED;
  const staleThreshold = staleDays * 24 * 60 * 60 * 1000;

  return analysisAge > staleThreshold;
}

export function calculateDerivedMetrics(channel: any): {
  historicalAvgViewsPerVideo: number;
  libraryEngagementRatio: number;
} {
  const avgViews =
    channel.statistics?.videoCount > 0
      ? parseInt(channel.statistics.viewCount) /
        parseInt(channel.statistics.videoCount)
      : 0;

  const engagementRatio =
    channel.statistics?.subscriberCount > 0
      ? parseInt(channel.statistics.viewCount) /
        parseInt(channel.statistics.subscriberCount)
      : 0;

  return {
    historicalAvgViewsPerVideo: avgViews,
    libraryEngagementRatio: engagementRatio,
  };
}

export function calculateChannelAge(createdAt: Date): number {
  const now = new Date();
  const ageInMs = now.getTime() - createdAt.getTime();
  return ageInMs / (1000 * 60 * 60 * 24 * 30); // Age in months
}

export function isValidChannelAge(
  ageInMonths: number,
  channelAge: "NEW" | "ESTABLISHED"
): boolean {
  if (channelAge === "NEW") {
    return ageInMonths <= 6;
  } else {
    return ageInMonths >= 6 && ageInMonths <= 24;
  }
}

export async function shouldSkipReAnalysis(
  channelData: ChannelCache
): Promise<boolean> {
  if (
    !channelData.latestAnalysis ||
    !channelData.analysisHistory ||
    channelData.analysisHistory.length === 0
  ) {
    return false;
  }

  const lastAnalysis =
    channelData.analysisHistory[channelData.analysisHistory.length - 1];
  const previousSubscriberCount = lastAnalysis.subscriberCountAtAnalysis;
  const currentSubscriberCount = channelData.latestStats.subscriberCount;

  const growthPercentage =
    ((currentSubscriberCount - previousSubscriberCount) /
      previousSubscriberCount) *
    100;
  return growthPercentage < 20;
}

/**
 * Parses an ISO 8601 duration string (e.g., "PT1M30S") into total seconds.
 * Handles hours, minutes, and seconds.
 * @param duration The ISO 8601 duration string.
 * @returns The total duration in seconds.
 */
export function parseISO8601Duration(duration: string): number {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = duration.match(regex);

  if (!matches) {
    return 0;
  }

  const hours = parseInt(matches[1] || "0", 10);
  const minutes = parseInt(matches[2] || "0", 10);
  const seconds = parseInt(matches[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

export function calculateConsistencyMetrics(
  videos: youtube_v3.Schema$Video[],
  subscriberCount: number
): {
  sourceVideoCount: number;
  metrics: {
    STANDARD: {
      outlierVideoCount: number;
      consistencyPercentage: number;
    };
    STRONG: {
      outlierVideoCount: number;
      consistencyPercentage: number;
    };
  };
} {
  if (videos.length === 0) {
    return {
      sourceVideoCount: 0,
      metrics: {
        STANDARD: { outlierVideoCount: 0, consistencyPercentage: 0 },
        STRONG: { outlierVideoCount: 0, consistencyPercentage: 0 },
      },
    };
  }

  let longFormVideoCount = 0;
  let standardOutlierCount = 0;
  let strongOutlierCount = 0;

  const standardThreshold = subscriberCount * getOutlierMultiplier("STANDARD");
  const strongThreshold = subscriberCount * getOutlierMultiplier("STRONG");

  for (const video of videos) {
    if (!video.contentDetails?.duration) {
      continue;
    }

    const durationInSeconds = parseISO8601Duration(
      video.contentDetails.duration
    );

    if (durationInSeconds < MIN_VIDEO_DURATION_SECONDS) {
      continue;
    }

    longFormVideoCount++;
    const viewCount = parseInt(video.statistics?.viewCount || "0");

    if (viewCount > standardThreshold && viewCount > MIN_OUTLIER_VIEW_COUNT) {
      standardOutlierCount++;
    }
    if (viewCount > strongThreshold && viewCount > MIN_OUTLIER_VIEW_COUNT) {
      strongOutlierCount++;
    }
  }

  const standardConsistencyPercentage =
    longFormVideoCount > 0
      ? (standardOutlierCount / longFormVideoCount) * 100
      : 0;
  const strongConsistencyPercentage =
    longFormVideoCount > 0
      ? (strongOutlierCount / longFormVideoCount) * 100
      : 0;

  return {
    sourceVideoCount: longFormVideoCount,
    metrics: {
      STANDARD: {
        outlierVideoCount: standardOutlierCount,
        consistencyPercentage: standardConsistencyPercentage,
      },
      STRONG: {
        outlierVideoCount: strongOutlierCount,
        consistencyPercentage: strongConsistencyPercentage,
      },
    },
  };
}
