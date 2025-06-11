import {
  AnalysisResult,
  NicheAnalysisOutput,
} from "../../types/analyzer.types.js";
import { ChannelCache } from "./analysis.types.js";

export function formatAndRankAnalysisResults(
  analysisResults: Array<{
    channelData: ChannelCache;
    consistencyPercentage: number;
    outlierCount: number;
  }>,
  maxResults: number,
  quotaExceeded: boolean // Added quotaExceeded parameter
): NicheAnalysisOutput {
  const rankedAndFormattedResults = analysisResults
    .map((result) => {
      const impactFactor =
        result.channelData.latestStats.videoCount > 0
          ? result.channelData.latestStats.subscriberCount /
            result.channelData.latestStats.videoCount
          : 0; // Avoid division by zero

      const confidenceScore =
        result.consistencyPercentage *
        Math.log10(result.outlierCount + 1) *
        impactFactor;

      const now = new Date();
      const createdAt = new Date(result.channelData.createdAt);
      const ageInMillis = now.getTime() - createdAt.getTime();
      const ageInDays = Math.floor(ageInMillis / (1000 * 60 * 60 * 24));

      return {
        channelId: result.channelData._id,
        channelTitle: result.channelData.channelTitle,
        channelAgeDays: ageInDays,
        subscriberCount: result.channelData.latestStats.subscriberCount,
        videoCount: result.channelData.latestStats.videoCount,
        analysis: {
          consistencyPercentage: result.consistencyPercentage,
          outlierVideoCount: result.outlierCount,
        },
        _confidenceScore: confidenceScore,
      };
    })
    .sort((a, b) => b._confidenceScore - a._confidenceScore)
    .slice(0, maxResults);

  const finalResults: AnalysisResult[] = rankedAndFormattedResults.map(
    ({ _confidenceScore, ...rest }) => rest
  );

  const finalStatus = quotaExceeded
    ? "PARTIAL_DUE_TO_QUOTA"
    : "COMPLETED_SUCCESSFULLY";

  const summary = {
    candidatesFound: 0, // This will be filled by the orchestrator
    candidatesAnalyzed: 0, // This will be filled by the orchestrator
    apiCreditsUsed: 0, // This will be filled by the orchestrator
    ...(quotaExceeded && {
      message:
        "Analysis was stopped prematurely due to YouTube API quota limits. The returned results are the best found from the portion of channels analyzed.",
    }),
  };

  return {
    status: finalStatus,
    summary: summary,
    results: finalResults,
  };
}
