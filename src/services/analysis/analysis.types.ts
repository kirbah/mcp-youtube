import { youtube_v3 } from "googleapis";

export interface SearchCache {
  _id?: string;
  searchParamsHash: string;
  searchParams: youtube_v3.Params$Resource$Search$List;
  results: any[];
  createdAt: Date;
  expiresAt: Date;
}

export interface ChannelCache {
  _id: string; // Channel ID
  channelTitle: string;
  createdAt: Date;
  status:
    | "candidate"
    | "archived_too_old"
    | "archived_low_potential"
    | "analyzed_low_consistency"
    | "analyzed_promising"
    | "archived_too_large";
  latestStats: {
    fetchedAt: Date;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
  };
  latestAnalysis?: {
    analyzedAt: Date;
    consistencyPercentage: number;
    sourceVideoCount: number;
    outlierVideoCount: number;
    outlierMagnitudeUsed: "STANDARD" | "STRONG";
  };
  analysisHistory: Array<{
    analyzedAt: Date;
    consistencyPercentage: number;
    subscriberCountAtAnalysis: number;
    videoCountAtAnalysis: number;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
  }>;
}
