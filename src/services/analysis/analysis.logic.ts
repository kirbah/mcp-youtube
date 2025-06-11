import { youtube_v3 } from "googleapis";
import { ChannelCache } from "./analysis.types.js";

export const STALENESS_DAYS_NEW = 14;
export const STALENESS_DAYS_ESTABLISHED = 45;
export const MIN_AVG_VIEWS_THRESHOLD = 1000;
export const MAX_SUBSCRIBER_CAP = 100_000;
export const MIN_OUTLIER_VIEW_COUNT = 1000;

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

export function calculateConsistencyPercentage(
  videos: youtube_v3.Schema$Video[],
  subscriberCount: number,
  outlierMultiplier: number
): { consistencyPercentage: number; outlierCount: number } {
  if (videos.length === 0) {
    return { consistencyPercentage: 0, outlierCount: 0 };
  }

  let outlierCount = 0;
  const threshold = subscriberCount * outlierMultiplier;

  for (const video of videos) {
    const viewCount = parseInt(video.statistics?.viewCount || "0");
    if (viewCount > threshold && viewCount > MIN_OUTLIER_VIEW_COUNT) {
      outlierCount++;
    }
  }

  const consistencyPercentage = (outlierCount / videos.length) * 100;
  return { consistencyPercentage, outlierCount };
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
