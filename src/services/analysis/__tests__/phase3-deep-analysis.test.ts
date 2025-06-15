// src/services/analysis/__tests__/phase3-deep-analysis.test.ts

import { CacheService } from "../../cache.service"; // Adjusted path
import { VideoManagement as VideoManagementService } from "../../../functions/videos"; // Adjusted path
import * as analysisLogic from "../analysis.logic"; // Adjusted path
import { executeDeepConsistencyAnalysis } from "../phase3-deep-analysis"; // Adjusted path
import { FindConsistentOutlierChannelsOptions } from "../../../types/analyzer.types"; // Adjusted path
import {
  ChannelCache,
  LatestAnalysis,
  HistoricalAnalysisEntry,
} from "../analysis.types"; // Adjusted path
import { youtube_v3 } from "googleapis";

// Helper function to create mock LatestAnalysis object
function createMockLatestAnalysis(
  overrides: Partial<LatestAnalysis> = {}
): LatestAnalysis {
  const defaultMetrics = {
    STANDARD: { consistencyPercentage: 0, outlierVideoCount: 0 },
    STRONG: { consistencyPercentage: 0, outlierVideoCount: 0 },
  };

  const finalMetrics = {
    STANDARD: { ...defaultMetrics.STANDARD, ...overrides.metrics?.STANDARD },
    STRONG: { ...defaultMetrics.STRONG, ...overrides.metrics?.STRONG },
  };

  const defaults: LatestAnalysis = {
    analyzedAt: new Date(),
    subscriberCountAtAnalysis: 1000,
    sourceVideoCount: 10,
    metrics: finalMetrics,
  };
  // Create a new object by spreading defaults and then overrides.
  // For 'metrics', it's already handled by 'finalMetrics'.
  const result = { ...defaults, ...overrides };
  result.metrics = finalMetrics; // Ensure metrics is the fully merged object.
  return result;
}

// Helper function to create mock ChannelCache object
function createMockChannelCache(
  overrides: Partial<ChannelCache> = {}
): ChannelCache {
  const defaults: ChannelCache = {
    _id: "defaultChannelId",
    // youtubeId is not in ChannelCache type, ensure it's added if service logic relies on it, or removed from tests.
    // For now, assuming it was an error in previous test structure and removing it from default mock.
    // If your service uses a 'youtubeId' field on ChannelCache, add it here.
    title: "Default Channel Title",
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "candidate",
    latestStats: {
      fetchedAt: new Date(),
      subscriberCount: 1000,
      videoCount: 100,
      viewCount: 100000,
    },
    analysisHistory: [],
    // latestAnalysis is optional
  };

  let final = { ...defaults, ...overrides };

  if (overrides.latestStats) {
    final.latestStats = { ...defaults.latestStats, ...overrides.latestStats };
  }
  // If latestAnalysis is provided in overrides, ensure it's a complete object or null
  if (overrides.hasOwnProperty("latestAnalysis")) {
    // Check if latestAnalysis is explicitly passed
    if (overrides.latestAnalysis === null) {
      final.latestAnalysis = null;
    } else if (overrides.latestAnalysis) {
      final.latestAnalysis = createMockLatestAnalysis(overrides.latestAnalysis);
    }
  }

  return final;
}

// Mock CacheService
jest.mock("../../cache.service");
const MockedCacheService = CacheService as jest.MockedClass<
  typeof CacheService
>;

// Mock VideoManagementService
jest.mock("../../../functions/videos");
const MockedVideoManagementService = VideoManagementService as jest.MockedClass<
  typeof VideoManagementService
>;

// Mock analysis.logic functions
jest.mock("../analysis.logic");
const mockedAnalysisLogic = analysisLogic as jest.Mocked<typeof analysisLogic>;

describe("executeDeepConsistencyAnalysis Function", () => {
  let cacheServiceInstance: jest.Mocked<CacheService>;
  let videoManagementInstance: jest.Mocked<VideoManagementService>;

  const baseMockOptions: FindConsistentOutlierChannelsOptions = {
    // query: 'test query', // query is not part of FindConsistentOutlierChannelsOptions used by phase3
    channelAge: "NEW",
    consistencyLevel: "MODERATE",
    outlierMagnitude: "STANDARD",
    maxResults: 10, // This is part of the broader options, but not directly used by phase3 logic itself from options
    // videoCategoryId and regionCode are optional in FindConsistentOutlierChannelsOptions
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cacheServiceInstance = new MockedCacheService();
    videoManagementInstance = new MockedVideoManagementService();

    // Ensure the mock instance methods are set up if not automatically by jest.mock
    if (!videoManagementInstance.fetchChannelRecentTopVideos) {
      videoManagementInstance.fetchChannelRecentTopVideos = jest.fn();
    }
    videoManagementInstance.fetchChannelRecentTopVideos.mockResolvedValue([]);

    mockedAnalysisLogic.isQuotaError.mockReturnValue(false);
    mockedAnalysisLogic.calculateChannelAgePublishedAfter.mockReturnValue(
      new Date().toISOString()
    );
    mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7);
    mockedAnalysisLogic.calculateConsistencyMetrics.mockReturnValue(
      // calculateConsistencyMetrics returns an object { sourceVideoCount, metrics: {...} }
      {
        sourceVideoCount: 10, // Default mock value
        metrics: createMockLatestAnalysis().metrics,
      }
    );
  });

  it("should attempt to run without throwing an error with empty inputs", async () => {
    cacheServiceInstance.findChannelsByIds.mockResolvedValue([]);
    await expect(
      executeDeepConsistencyAnalysis(
        [],
        baseMockOptions,
        cacheServiceInstance,
        videoManagementInstance
      )
    ).resolves.toEqual({ results: [], quotaExceeded: false });
  });

  describe("specific scenarios", () => {
    it("should skip re-analysis if channel growth is less than 20% and use promising historical analysis", async () => {
      const mockChannel = createMockChannelCache({
        _id: "channel1",
        latestStats: { subscriberCount: 1190 }, // < 20% growth from 1000
        latestAnalysis: createMockLatestAnalysis({
          subscriberCountAtAnalysis: 1000,
          metrics: {
            STANDARD: { consistencyPercentage: 0.8, outlierVideoCount: 8 },
          },
        }),
        status: "analyzed_promising",
      });
      cacheServiceInstance.findChannelsByIds.mockResolvedValue([mockChannel]);
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7); // 0.8 > 0.7

      const { results } = await executeDeepConsistencyAnalysis(
        ["channel1"],
        baseMockOptions,
        cacheServiceInstance,
        videoManagementInstance
      );

      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).not.toHaveBeenCalled();
      expect(cacheServiceInstance.updateChannel).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("analyzed_promising");
    });

    it("should skip re-analysis if channel growth is less than 20% and skip if historical analysis is not promising", async () => {
      const mockChannel = createMockChannelCache({
        _id: "channel1",
        latestStats: { subscriberCount: 1100 }, // < 20% growth
        latestAnalysis: createMockLatestAnalysis({
          subscriberCountAtAnalysis: 1000,
          metrics: {
            STANDARD: { consistencyPercentage: 0.6, outlierVideoCount: 6 },
          }, // Not promising
        }),
        status: "analyzed_failed",
      });
      cacheServiceInstance.findChannelsByIds.mockResolvedValue([mockChannel]);
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7); // 0.6 < 0.7

      const { results } = await executeDeepConsistencyAnalysis(
        ["channel1"],
        baseMockOptions,
        cacheServiceInstance,
        videoManagementInstance
      );
      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).not.toHaveBeenCalled();
      expect(cacheServiceInstance.updateChannel).not.toHaveBeenCalled();
      expect(results).toHaveLength(0);
    });

    it("should use cached video list if available and channel passes growth gate", async () => {
      const mockChannel = createMockChannelCache({
        _id: "channel2",
        latestStats: { subscriberCount: 1500 }, // >20% growth from 1000
        latestAnalysis: createMockLatestAnalysis({
          // Provide a latestAnalysis that would make it pass growth gate
          subscriberCountAtAnalysis: 1000,
          metrics: {
            STANDARD: { consistencyPercentage: 0.5, outlierVideoCount: 2 },
          }, // Old analysis not promising
        }),
        status: "candidate",
      });
      const mockVideos: youtube_v3.Schema$Video[] = [
        {
          id: "video1",
          snippet: {
            publishedAt: new Date().toISOString(),
            title: "v1",
            channelId: "channel2",
          },
          statistics: { viewCount: "1000" },
        },
      ];

      cacheServiceInstance.findChannelsByIds.mockResolvedValue([mockChannel]);
      cacheServiceInstance.getVideoListCache.mockResolvedValue({
        _id: "channel2",
        videos: mockVideos,
        fetchedAt: new Date(),
      });
      mockedAnalysisLogic.calculateConsistencyMetrics.mockReturnValue({
        sourceVideoCount: mockVideos.length,
        metrics: {
          STANDARD: { consistencyPercentage: 0.8, outlierVideoCount: 1 },
          STRONG: { consistencyPercentage: 0.0, outlierVideoCount: 0 },
        },
      });
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7); // 0.8 > 0.7

      const { results } = await executeDeepConsistencyAnalysis(
        ["channel2"],
        baseMockOptions,
        cacheServiceInstance,
        videoManagementInstance
      );

      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).not.toHaveBeenCalled();
      expect(cacheServiceInstance.setVideoListCache).not.toHaveBeenCalled(); // Because it used the cache
      expect(cacheServiceInstance.updateChannel).toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe("channel2");
      expect(results[0].status).toBe("analyzed_promising");
    });

    it("should not call getVideoListCache if growth gate check fails", async () => {
      const mockChannel = createMockChannelCache({
        _id: "channel-no-growth",
        latestStats: { subscriberCount: 1100 }, // < 20% growth from 1000
        latestAnalysis: createMockLatestAnalysis({
          subscriberCountAtAnalysis: 1000,
          metrics: {
            STANDARD: { consistencyPercentage: 0.6, outlierVideoCount: 5 },
          }, // Not promising
        }),
        status: "analyzed_failed",
      });
      cacheServiceInstance.findChannelsByIds.mockResolvedValue([mockChannel]);
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7);

      await executeDeepConsistencyAnalysis(
        ["channel-no-growth"],
        baseMockOptions,
        cacheServiceInstance,
        videoManagementInstance
      );
      expect(cacheServiceInstance.getVideoListCache).not.toHaveBeenCalled();
      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).not.toHaveBeenCalled();
    });

    it("should archive old analysis and update new one atomically for a promising channel", async () => {
      const oldAnalysisData = createMockLatestAnalysis({
        analyzedAt: new Date(Date.now() - 100000), // Older date
        subscriberCountAtAnalysis: 1000,
        sourceVideoCount: 8,
        metrics: {
          STANDARD: { consistencyPercentage: 0.75, outlierVideoCount: 2 }, // Was promising
          STRONG: { consistencyPercentage: 0.5, outlierVideoCount: 4 },
        },
      });
      const mockChannel = createMockChannelCache({
        _id: "channel3",
        latestStats: { subscriberCount: 1500 }, // Significant growth (passes 20% gate over 1000)
        latestAnalysis: oldAnalysisData,
        status: "analyzed_promising", // Initial status
      });
      const newMockVideos: youtube_v3.Schema$Video[] = [
        {
          id: "video3",
          snippet: {
            publishedAt: new Date().toISOString(),
            title: "v3",
            channelId: "channel3",
          },
          statistics: { viewCount: "3000" },
        },
      ];
      const newCalculatedMetricsResult = {
        sourceVideoCount: newMockVideos.length,
        metrics: {
          STANDARD: { consistencyPercentage: 0.85, outlierVideoCount: 1 }, // New analysis is promising
          STRONG: { consistencyPercentage: 0.6, outlierVideoCount: 0 },
        },
      };

      cacheServiceInstance.findChannelsByIds.mockResolvedValue([mockChannel]);
      cacheServiceInstance.getVideoListCache.mockResolvedValue(null); // Force fetch
      videoManagementInstance.fetchChannelRecentTopVideos.mockResolvedValue(
        newMockVideos
      );
      mockedAnalysisLogic.calculateConsistencyMetrics.mockReturnValue(
        newCalculatedMetricsResult
      );
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7); // 0.85 > 0.7

      const { results } = await executeDeepConsistencyAnalysis(
        ["channel3"],
        baseMockOptions,
        cacheServiceInstance,
        videoManagementInstance
      );

      expect(cacheServiceInstance.updateChannel).toHaveBeenCalledTimes(1);
      const updateArg = cacheServiceInstance.updateChannel.mock.calls[0][1];
      expect(updateArg.$set).toBeDefined();
      expect(
        updateArg.$set.latestAnalysis.metrics["STANDARD"].consistencyPercentage
      ).toBe(0.85);
      expect(updateArg.$set.status).toBe("analyzed_promising");
      expect(updateArg.$push).toBeDefined();
      expect(updateArg.$push.analysisHistory).toEqual(oldAnalysisData);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("analyzed_promising");
      expect(
        results[0].latestAnalysis.metrics.STANDARD.consistencyPercentage
      ).toBe(0.85);
    });

    it("should stop analysis and return quotaExceeded true when API quota is hit", async () => {
      const channelId1 = "channel1_success";
      const channelId2 = "channel2_fail_quota";
      const channel1Data = createMockChannelCache({
        _id: channelId1,
        youtubeId: channelId1, // youtubeId might be used by fetchChannelRecentTopVideos if it differs from _id
        latestStats: { subscriberCount: 1000 },
        latestAnalysis: null, // No prior analysis, passes growth gate
        status: "candidate",
      });
      const channel2Data = createMockChannelCache({
        _id: channelId2,
        youtubeId: channelId2,
        latestStats: { subscriberCount: 2000 },
        latestAnalysis: null,
        status: "candidate",
      });
      const quotaError = new Error("API Quota Exceeded");
      const mockVideosChannel1: youtube_v3.Schema$Video[] = [
        {
          id: "videoC1_1",
          snippet: {
            publishedAt: "sometime",
            title: "t",
            channelId: channelId1,
          },
          statistics: { viewCount: "1" },
        },
      ];

      const publishedAfterString = new Date().toISOString();
      mockedAnalysisLogic.calculateChannelAgePublishedAfter.mockReturnValue(
        publishedAfterString
      );

      cacheServiceInstance.findChannelsByIds.mockImplementation(async (ids) => {
        const data = [];
        if (ids.includes(channelId1)) data.push(channel1Data);
        if (ids.includes(channelId2)) data.push(channel2Data);
        return data;
      });
      cacheServiceInstance.getVideoListCache.mockResolvedValue(null);

      videoManagementInstance.fetchChannelRecentTopVideos.mockImplementation(
        async (chId, pubAfter) => {
          // Correct signature
          expect(pubAfter).toBe(publishedAfterString); // Verify publishedAfter is passed
          if (chId === channel1Data._id) return mockVideosChannel1; // Use _id for comparison
          if (chId === channel2Data._id) throw quotaError;
          return [];
        }
      );

      mockedAnalysisLogic.isQuotaError.mockImplementation(
        (err) => err === quotaError
      );
      mockedAnalysisLogic.calculateConsistencyMetrics.mockImplementation(
        (videos, _subs) => {
          if (videos === mockVideosChannel1) {
            return {
              sourceVideoCount: mockVideosChannel1.length,
              metrics: {
                STANDARD: { consistencyPercentage: 0.9, outlierVideoCount: 0 },
                STRONG: { consistencyPercentage: 0, outlierVideoCount: 0 },
              },
            };
          }
          return {
            sourceVideoCount: 0,
            metrics: {
              STANDARD: { consistencyPercentage: 0, outlierVideoCount: 0 },
              STRONG: { consistencyPercentage: 0, outlierVideoCount: 0 },
            },
          };
        }
      );
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7); // 0.9 > 0.7

      const { results, quotaExceeded } = await executeDeepConsistencyAnalysis(
        [channelId1, channelId2], // These are the _id values
        baseMockOptions,
        cacheServiceInstance,
        videoManagementInstance
      );

      expect(quotaExceeded).toBe(true);
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe(channelId1);
      expect(results[0].status).toBe("analyzed_promising");
      expect(cacheServiceInstance.updateChannel).toHaveBeenCalledTimes(1);
      expect(cacheServiceInstance.updateChannel).toHaveBeenCalledWith(
        channelId1,
        expect.anything()
      );

      const updateCalls = cacheServiceInstance.updateChannel.mock.calls;
      const channel2Call = updateCalls.find((call) => call[0] === channelId2);
      expect(channel2Call).toBeUndefined();

      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledWith(channel1Data._id, publishedAfterString);
      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledWith(channel2Data._id, publishedAfterString);
    });

    it("should update status to analyzed_low_consistency and exclude from results if new analysis is not promising", async () => {
      const channelId = "low_consistency_channel";
      const mockChannel = createMockChannelCache({
        _id: channelId,
        youtubeId: channelId,
        latestStats: { subscriberCount: 1000 },
        latestAnalysis: null, // Ensures it passes any growth gate by having no prior analysis
        status: "candidate",
      });

      cacheServiceInstance.findChannelsByIds.mockResolvedValue([mockChannel]);
      cacheServiceInstance.getVideoListCache.mockResolvedValue(null); // Trigger new fetch

      const mockFetchedVideos: youtube_v3.Schema$Video[] = [
        {
          id: "video1",
          snippet: {
            publishedAt: new Date().toISOString(),
            title: "v1",
            channelId: channelId,
          },
          statistics: { viewCount: "100" },
        },
        {
          id: "video2",
          snippet: {
            publishedAt: new Date().toISOString(),
            title: "v2",
            channelId: channelId,
          },
          statistics: { viewCount: "200" },
        },
        {
          id: "video3",
          snippet: {
            publishedAt: new Date().toISOString(),
            title: "v3",
            channelId: channelId,
          },
          statistics: { viewCount: "300" },
        },
      ];
      videoManagementInstance.fetchChannelRecentTopVideos.mockResolvedValue(
        mockFetchedVideos
      );

      const lowConsistencyMetrics = {
        sourceVideoCount: mockFetchedVideos.length,
        metrics: {
          STANDARD: { consistencyPercentage: 0.5, outlierVideoCount: 2 }, // 0.5 < 0.7 threshold
          STRONG: { consistencyPercentage: 0.2, outlierVideoCount: 3 },
        },
      };
      mockedAnalysisLogic.calculateConsistencyMetrics.mockReturnValue(
        lowConsistencyMetrics
      );
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7); // Standard threshold

      cacheServiceInstance.setVideoListCache.mockResolvedValue(undefined); // Mock a successful void promise
      cacheServiceInstance.updateChannel.mockResolvedValue(undefined); // Mock a successful void promise

      const publishedAfterString = new Date().toISOString();
      mockedAnalysisLogic.calculateChannelAgePublishedAfter.mockReturnValue(
        publishedAfterString
      );

      const { results } = await executeDeepConsistencyAnalysis(
        [channelId],
        baseMockOptions, // Uses 'STANDARD' and consistencyLevel 'MODERATE' (threshold 0.7)
        cacheServiceInstance,
        videoManagementInstance
      );

      expect(cacheServiceInstance.updateChannel).toHaveBeenCalledTimes(1);
      const [updatedChannelId, updatePayload] =
        cacheServiceInstance.updateChannel.mock.calls[0];

      expect(updatedChannelId).toBe(channelId);
      expect(updatePayload.$set).toBeDefined();
      expect(updatePayload.$set.status).toBe("analyzed_low_consistency");
      expect(updatePayload.$set.latestAnalysis).toBeDefined();
      expect(
        updatePayload.$set.latestAnalysis.metrics.STANDARD.consistencyPercentage
      ).toBe(0.5);
      expect(updatePayload.$set.latestAnalysis.sourceVideoCount).toBe(
        mockFetchedVideos.length
      );
      expect(updatePayload.$set.latestAnalysis.subscriberCountAtAnalysis).toBe(
        mockChannel.latestStats.subscriberCount
      );

      expect(results).toHaveLength(0); // Channel should not be in promising results
    });

    it("should skip analysis if fetched video list is empty", async () => {
      const channelId = "empty_fetch_channel";
      const mockChannel = createMockChannelCache({
        _id: channelId,
        youtubeId: channelId,
        latestAnalysis: null, // Pass growth gate
        status: "candidate",
      });

      cacheServiceInstance.findChannelsByIds.mockResolvedValue([mockChannel]);
      cacheServiceInstance.getVideoListCache.mockResolvedValue(null); // Trigger fetch
      videoManagementInstance.fetchChannelRecentTopVideos.mockResolvedValue([]); // Simulate empty fetch

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {}); // Spy and suppress output

      const publishedAfterString = new Date().toISOString();
      mockedAnalysisLogic.calculateChannelAgePublishedAfter.mockReturnValue(
        publishedAfterString
      );

      const { results } = await executeDeepConsistencyAnalysis(
        [channelId],
        baseMockOptions,
        cacheServiceInstance,
        videoManagementInstance
      );

      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledTimes(1);
      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledWith(channelId, publishedAfterString);

      expect(cacheServiceInstance.setVideoListCache).not.toHaveBeenCalled();
      expect(
        mockedAnalysisLogic.calculateConsistencyMetrics
      ).not.toHaveBeenCalled();
      expect(cacheServiceInstance.updateChannel).not.toHaveBeenCalled();
      expect(results).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `No videos found for channel ${channelId} in the specified time window or cache`
      );

      consoleErrorSpy.mockRestore(); // Restore original console.error
    });

    it("should skip analysis if cached video list is empty", async () => {
      const channelId = "empty_cache_channel";
      const mockChannel = createMockChannelCache({
        _id: channelId,
        youtubeId: channelId,
        latestAnalysis: null, // Pass growth gate
        status: "candidate",
      });

      cacheServiceInstance.findChannelsByIds.mockResolvedValue([mockChannel]);
      // Simulate cache hit with an empty video list
      cacheServiceInstance.getVideoListCache.mockResolvedValue({
        _id: channelId,
        videos: [],
        fetchedAt: new Date(),
      });

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { results } = await executeDeepConsistencyAnalysis(
        [channelId],
        baseMockOptions,
        cacheServiceInstance,
        videoManagementInstance
      );

      expect(cacheServiceInstance.getVideoListCache).toHaveBeenCalledTimes(1);
      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).not.toHaveBeenCalled();
      expect(
        mockedAnalysisLogic.calculateConsistencyMetrics
      ).not.toHaveBeenCalled();
      expect(cacheServiceInstance.updateChannel).not.toHaveBeenCalled();
      expect(results).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `No videos found for channel ${channelId} in the specified time window or cache`
      );

      consoleErrorSpy.mockRestore();
    });

    it("should log error and continue if a generic error occurs during video fetch", async () => {
      const successChannelId = "channel_generic_success";
      const failChannelId = "channel_generic_fail";

      const channel1Data = createMockChannelCache({
        _id: successChannelId,
        youtubeId: successChannelId,
        latestAnalysis: null,
        latestStats: { subscriberCount: 1200 }, // Ensure it's different for clarity if needed
      });
      const channel2Data = createMockChannelCache({
        _id: failChannelId,
        youtubeId: failChannelId,
        latestAnalysis: null,
      });

      cacheServiceInstance.findChannelsByIds.mockResolvedValue([
        channel1Data,
        channel2Data,
      ]);
      cacheServiceInstance.getVideoListCache.mockResolvedValue(null); // Trigger fetch for both

      const genericError = new Error("Network Error");
      const mockSuccessVideos: youtube_v3.Schema$Video[] = [
        {
          id: "videoS1",
          snippet: {
            publishedAt: new Date().toISOString(),
            title: "vS1",
            channelId: successChannelId,
          },
          statistics: { viewCount: "1000" },
        },
      ];

      const publishedAfterString = new Date().toISOString();
      mockedAnalysisLogic.calculateChannelAgePublishedAfter.mockReturnValue(
        publishedAfterString
      );

      videoManagementInstance.fetchChannelRecentTopVideos.mockImplementation(
        async (chId, pubAfter) => {
          expect(pubAfter).toBe(publishedAfterString);
          if (chId === successChannelId) return mockSuccessVideos;
          if (chId === failChannelId) throw genericError;
          return [];
        }
      );

      mockedAnalysisLogic.isQuotaError.mockImplementation(
        (err) => err !== genericError
      ); // Returns false for genericError

      mockedAnalysisLogic.calculateConsistencyMetrics.mockImplementation(
        (videos, subsCount) => {
          if (
            videos === mockSuccessVideos &&
            subsCount === channel1Data.latestStats.subscriberCount
          ) {
            return {
              sourceVideoCount: mockSuccessVideos.length,
              metrics: {
                STANDARD: { consistencyPercentage: 0.8, outlierVideoCount: 1 },
                STRONG: { consistencyPercentage: 0.5, outlierVideoCount: 0 },
              },
            };
          }
          // Default for any other unexpected call
          return {
            sourceVideoCount: 0,
            metrics: {
              STANDARD: { consistencyPercentage: 0, outlierVideoCount: 0 },
              STRONG: { consistencyPercentage: 0, outlierVideoCount: 0 },
            },
          };
        }
      );
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7); // 0.8 > 0.7, so successChannel is promising

      cacheServiceInstance.setVideoListCache.mockResolvedValue(undefined);
      cacheServiceInstance.updateChannel.mockResolvedValue(undefined);

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { results, quotaExceeded } = await executeDeepConsistencyAnalysis(
        [successChannelId, failChannelId],
        baseMockOptions,
        cacheServiceInstance,
        videoManagementInstance
      );

      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledTimes(2);
      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledWith(successChannelId, publishedAfterString);
      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledWith(failChannelId, publishedAfterString);

      expect(cacheServiceInstance.updateChannel).toHaveBeenCalledTimes(1);
      expect(cacheServiceInstance.updateChannel).toHaveBeenCalledWith(
        successChannelId,
        expect.anything()
      );

      const updateCalls = cacheServiceInstance.updateChannel.mock.calls;
      const failChannelUpdateCall = updateCalls.find(
        (call) => call[0] === failChannelId
      );
      expect(failChannelUpdateCall).toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to analyze channel ${failChannelId}: ${genericError.message}`
      );

      expect(quotaExceeded).toBe(false);
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe(successChannelId);
      expect(results[0].status).toBe("analyzed_promising");

      consoleErrorSpy.mockRestore();
    });
  });
});
