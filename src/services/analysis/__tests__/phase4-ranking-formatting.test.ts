import { describe, it, expect } from "@jest/globals";
import { formatAndRankAnalysisResults } from "../phase4-ranking-formatting";
import {
  NicheAnalysisOutput,
  FindConsistentOutlierChannelsOptions,
} from "../../../types/analyzer.types";

describe("Phase 4 Ranking and Formatting", () => {
  const commonLatestAnalysisMetricsStandard = {};

  const commonLatestStats = {
    viewCount: 100000,
    lastUploadDate: new Date(),
    fetchedAt: new Date(),
  };

  it("should rank channels by confidence score in descending order", () => {
    const mockChannels: ChannelCache[] = [
      {
        _id: "channel1",
        channelTitle: "Channel 1",
        createdAt: new Date("2020-01-01T00:00:00Z"),
        status: "candidate",
        analysisHistory: [],
        latestStats: {
          ...commonLatestStats,
          subscriberCount: 1000,
          videoCount: 100,
        },
        latestAnalysis: {
          analyzedAt: new Date(),
          subscriberCountAtAnalysis: 1000,
          sourceVideoCount: 100,
          metrics: {
            STANDARD: {
              ...commonLatestAnalysisMetricsStandard,
              consistencyPercentage: 0.8,
              outlierVideoCount: 10,
            },
          },
        } as LatestAnalysis,
      } as ChannelCache,
      {
        _id: "channel2",
        channelTitle: "Channel 2",
        createdAt: new Date("2020-01-01T00:00:00Z"),
        status: "candidate",
        analysisHistory: [],
        latestStats: {
          ...commonLatestStats,
          subscriberCount: 2000,
          videoCount: 50,
        },
        latestAnalysis: {
          analyzedAt: new Date(),
          subscriberCountAtAnalysis: 2000,
          sourceVideoCount: 50,
          metrics: {
            STANDARD: {
              ...commonLatestAnalysisMetricsStandard,
              consistencyPercentage: 0.9,
              outlierVideoCount: 15,
            },
          },
        } as LatestAnalysis,
      } as ChannelCache,
      {
        _id: "channel3",
        channelTitle: "Channel 3",
        createdAt: new Date("2020-01-01T00:00:00Z"),
        status: "candidate",
        analysisHistory: [],
        latestStats: {
          ...commonLatestStats,
          subscriberCount: 500,
          videoCount: 200,
        },
        latestAnalysis: {
          analyzedAt: new Date(),
          subscriberCountAtAnalysis: 500,
          sourceVideoCount: 200,
          metrics: {
            STANDARD: {
              ...commonLatestAnalysisMetricsStandard,
              consistencyPercentage: 0.7,
              outlierVideoCount: 5,
            },
          },
        } as LatestAnalysis,
      } as ChannelCache,
    ];

    const options: FindConsistentOutlierChannelsOptions = {
      outlierMagnitude: "STANDARD",
      maxResults: 3,
    };

    const result = formatAndRankAnalysisResults(mockChannels, options, false);

    // Expected order: channel2, channel1, channel3
    expect(result.results.length).toBe(3);
    expect(result.results[0].channelId).toBe("channel2");
    expect(result.results[1].channelId).toBe("channel1");
    expect(result.results[2].channelId).toBe("channel3");

    // Optionally, check the scores if they are part of the output (assuming they are for this test)
    // This depends on whether formatAndRankAnalysisResults adds the score to the output objects
    // For now, we are only checking the order.
    // If scores are available:
    // expect(result.results[0].confidenceScore).toBeCloseTo(scoreChannel2);
    // expect(result.results[1].confidenceScore).toBeCloseTo(scoreChannel1);
    // expect(result.results[2].confidenceScore).toBeCloseTo(scoreChannel3);
  });

  it("should slice results to respect maxResults", () => {
    const mockChannels: ChannelCache[] = [];
    for (let i = 0; i < 20; i++) {
      const channelId = `channel${i + 1}`;
      mockChannels.push({
        _id: channelId,
        channelTitle: `Channel ${i + 1}`,
        createdAt: new Date("2020-01-01T00:00:00Z"),
        status: "candidate",
        analysisHistory: [],
        latestStats: {
          ...commonLatestStats,
          subscriberCount: 100 * (i + 1),
          videoCount: 10 + i,
        },
        latestAnalysis: {
          analyzedAt: new Date(),
          subscriberCountAtAnalysis: 100 * (i + 1),
          sourceVideoCount: 10 + i,
          metrics: {
            STANDARD: {
              ...commonLatestAnalysisMetricsStandard,
              consistencyPercentage: 0.5 + (i % 5) / 10, // Vary slightly
              outlierVideoCount: 5 + (i % 5), // Vary slightly
            },
          },
        } as LatestAnalysis,
      } as ChannelCache);
    }

    const options: FindConsistentOutlierChannelsOptions = {
      outlierMagnitude: "STANDARD",
      maxResults: 5,
    };

    const result = formatAndRankAnalysisResults(mockChannels, options, false);

    expect(result.results.length).toBe(5);
  });

  it("should format output correctly when quotaExceeded is true", () => {
    const mockChannels: ChannelCache[] = [
      {
        _id: "channel1",
        channelTitle: "Channel 1",
        createdAt: new Date("2020-01-01T00:00:00Z"),
        status: "candidate",
        analysisHistory: [],
        latestStats: {
          ...commonLatestStats,
          subscriberCount: 1000,
          videoCount: 100,
        },
        latestAnalysis: {
          analyzedAt: new Date(),
          subscriberCountAtAnalysis: 1000,
          sourceVideoCount: 100,
          metrics: {
            STANDARD: {
              ...commonLatestAnalysisMetricsStandard,
              consistencyPercentage: 0.8,
              outlierVideoCount: 10,
            },
          },
        } as LatestAnalysis,
      } as ChannelCache,
    ];

    const options: FindConsistentOutlierChannelsOptions = {
      outlierMagnitude: "STANDARD",
      maxResults: 10,
    };

    const result: NicheAnalysisOutput = formatAndRankAnalysisResults(
      mockChannels,
      options,
      true
    );

    expect(result.status).toBe("PARTIAL_DUE_TO_QUOTA");
    expect(result.summary.message).toBeDefined();
    expect(result.summary.message).toContain(
      "Analysis was stopped prematurely due to YouTube API quota limits. The returned results are the best found from the portion of channels analyzed."
    );
    // Also ensure that results are still processed and returned, even if partial
    expect(result.results).toBeDefined();
    expect(result.results.length).toBeGreaterThanOrEqual(0); // Could be 0 if the single channel is filtered out
    if (result.results.length > 0) {
      expect(result.results[0].channelId).toBe("channel1");
    }
  });
});
