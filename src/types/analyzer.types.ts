export interface FindConsistentOutlierChannelsOptions {
  query: string;
  channelAge: "NEW" | "ESTABLISHED";
  consistencyLevel: "MODERATE" | "HIGH";
  outlierMagnitude: "STANDARD" | "STRONG";
  videoCategoryId?: string;
  regionCode?: string;
  maxResults: number;
}

export interface AnalysisResult {
  channelId: string;
  channelTitle: string;
  channelAgeDays: number;
  subscriberCount: number;
  videoCount: number;
  analysis: {
    consistencyPercentage: number;
    outlierVideoCount: number;
  };
}

export interface AnalysisSummary {
  candidatesFound: number;
  candidatesAnalyzed: number;
  apiCreditsUsed: number;
  message?: string;
}

export interface NicheAnalysisOutput {
  status: "PARTIAL_DUE_TO_QUOTA" | "COMPLETED_SUCCESSFULLY";
  summary: AnalysisSummary;
  results: AnalysisResult[];
}
