import { youtube_v3 } from "googleapis";

// A LEAN object for the history array to prevent bloat.
// It stores a snapshot of the most important top-level metrics.
export interface HistoricalAnalysisEntry {
  analyzedAt: Date;
  subscriberCountAtAnalysis: number;
  sourceVideoCount: number;
  // We capture the consistency metrics for both STANDARD and STRONG in history.
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
}

// A RICH object for the most recent analysis, containing all pre-computed data.
export interface LatestAnalysis {
  analyzedAt: Date;
  subscriberCountAtAnalysis: number; // <-- ADD THIS FIELD
  sourceVideoCount: number; // The number of long-form videos we based this on.
  metrics: {
    // Pre-calculated metrics for the "STANDARD" (views > 1x subs) rule.
    STANDARD: {
      outlierVideoCount: number;
      consistencyPercentage: number;
    };
    // Pre-calculated metrics for the "STRONG" (views > 3x subs) rule.
    STRONG: {
      outlierVideoCount: number;
      consistencyPercentage: number;
    };
  };
}

export interface SearchCache {
  _id?: string;
  searchParamsHash: string;
  searchParams: youtube_v3.Params$Resource$Search$List;
  results: youtube_v3.Schema$SearchResult[];
  createdAt: Date;
  expiresAt: Date;
}

export interface ChannelCache {
  _id: string; // Channel ID
  channelTitle: string;
  manual_review_notes?: string; // Optional notes for manual review
  createdAt: Date;
  status:
    | "candidate"
    | "archived_too_old"
    | "archived_low_potential"
    | "archived_low_sample_size"
    | "analyzed_low_consistency"
    | "analyzed_promising"
    | "analyzed_promising_prime_candidate"
    | "analyzed_promising_monitor"
    | "archived_unreplicable"
    | "archived_niche_mismatch"
    | "archived_too_large"
    | "archived_too_small";
  latestStats: {
    fetchedAt: Date;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
  };
  // The rich object for all real-time checks.
  latestAnalysis?: LatestAnalysis;

  // The lean, append-only log for historical data.
  analysisHistory: HistoricalAnalysisEntry[];
}

export interface VideoListCache {
  _id: string; // Channel ID
  videos: youtube_v3.Schema$Video[]; // Array of video objects
  fetchedAt: Date;
}
