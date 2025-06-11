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
  const now = new Date();
  const monthsToSubtract = channelAge === "NEW" ? 6 : 24;
  const millisecondsToSubtract = monthsToSubtract * 30 * 24 * 60 * 60 * 1000;
  const targetTime = new Date(now.getTime() - millisecondsToSubtract);
  return targetTime.toISOString();
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
  if (!channelData.latestAnalysis || !channelData.analysisHistory.length) {
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

export function calculateConsistencyPercentage(
  videos: youtube_v3.Schema$Video[],
  subscriberCount: number,
  outlierMultiplier: number
): {
  consistencyPercentage: number;
  outlierCount: number;
  sourceVideoCount: number;
} {
  if (videos.length === 0) {
    return { consistencyPercentage: 0, outlierCount: 0, sourceVideoCount: 0 };
  }

  let longFormVideoCount = 0;
  let outlierLongFormVideoCount = 0;
  const threshold = subscriberCount * outlierMultiplier;

  for (const video of videos) {
    // Ensure contentDetails and duration exist before parsing
    if (!video.contentDetails?.duration) {
      continue; // Skip videos without duration information
    }

    const durationInSeconds = parseISO8601Duration(
      video.contentDetails.duration
    );

    // THE NEW FILTER: If the video is a Short (or just very short), skip it entirely.
    if (durationInSeconds < MIN_VIDEO_DURATION_SECONDS) {
      continue; // Ignore this video, move to the next one
    }

    // This video is confirmed to be long-form.
    longFormVideoCount++;

    // Now, perform the existing outlier check on this long-form video
    const viewCount = parseInt(video.statistics?.viewCount || "0");
    if (viewCount > threshold && viewCount > MIN_OUTLIER_VIEW_COUNT) {
      outlierLongFormVideoCount++;
    }
  }

  // The new, more accurate consistency calculation:
  // Avoid division by zero if a channel has NO long-form videos.
  const consistencyPercentage =
    longFormVideoCount > 0
      ? (outlierLongFormVideoCount / longFormVideoCount) * 100
      : 0;

  return {
    consistencyPercentage: consistencyPercentage,
    outlierCount: outlierLongFormVideoCount,
    sourceVideoCount: longFormVideoCount,
  };
}
