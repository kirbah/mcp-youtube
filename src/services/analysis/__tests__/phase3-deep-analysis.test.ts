// src/services/analysis/__tests__/phase3-deep-analysis.test.ts

import { CacheService } from "../../cache.service"; // Adjusted path
import { YoutubeService as VideoManagementService } from "../../youtube.service.js"; // Adjusted path
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

  const mergedMetrics = {
    STANDARD: { ...defaultMetrics.STANDARD, ...overrides.metrics?.STANDARD },
    STRONG: { ...defaultMetrics.STRONG, ...overrides.metrics?.STRONG },
  };

  const defaults: LatestAnalysis = {
    analyzedAt: new Date(),
    subscriberCountAtAnalysis: 1000,
    sourceVideoCount: 10,
    metrics: mergedMetrics, // Use mergedMetrics here
  };
  // Create a new object by spreading defaults and then overrides.
  // For 'metrics', it's already handled by 'mergedMetrics'.
  const result = { ...defaults, ...overrides };
  result.metrics = mergedMetrics; // Ensure metrics is the fully merged object.
  return result;
}

// Helper function to create mock ChannelCache object
function createMockChannelCache(
  overrides: Partial<ChannelCache> = {}
): ChannelCache {
  const defaults: ChannelCache = {
    _id: "defaultChannelId",
    channelTitle: "Default Channel Title",
    createdAt: new Date(),
    status: "candidate",
    latestStats: {
      fetchedAt: new Date(),
      subscriberCount: 1000,
      videoCount: 100,
      viewCount: 100000,
    },
    analysisHistory: [],
    latestAnalysis: undefined,
  };

  let final = { ...defaults, ...overrides };

  // Ensure latestStats is fully merged
  if (overrides.latestStats) {
    final.latestStats = { ...defaults.latestStats, ...overrides.latestStats };
  }

  // Handle latestAnalysis explicitly
  if (overrides.hasOwnProperty("latestAnalysis")) {
    if (overrides.latestAnalysis === null) {
      final.latestAnalysis = undefined; // Change null to undefined
    } else if (overrides.latestAnalysis) {
      final.latestAnalysis = createMockLatestAnalysis(overrides.latestAnalysis);
    } else {
      final.latestAnalysis = undefined; // If explicitly set to undefined
    }
  } else if (defaults.latestAnalysis !== undefined) {
    final.latestAnalysis = defaults.latestAnalysis;
  }

  return final;
}

// Mock CacheService
jest.mock("../../cache.service", () => {
  return {
    CacheService: jest.fn().mockImplementation(() => ({
      findChannelsByIds: jest.fn(),
      getVideoListCache: jest.fn(),
      setVideoListCache: jest.fn(),
      updateChannel: jest.fn(),
    })),
  };
});
const MockedCacheService = CacheService as jest.MockedClass<
  typeof CacheService
>;

// Mock VideoManagementService
jest.mock("../../youtube.service.js", () => {
  // Corrected path and service name
  return {
    YoutubeService: jest.fn().mockImplementation(() => ({
      fetchChannelRecentTopVideos: jest.fn(),
      // Add other methods if they are called in this test file and need mocking
    })),
  };
});
const MockedVideoManagementService = VideoManagementService as jest.MockedClass<
  typeof VideoManagementService
>;

// Mock analysis.logic functions
jest.mock("../analysis.logic");
const mockedAnalysisLogic = analysisLogic as jest.Mocked<typeof analysisLogic>;

// Mock the MongoDB Db object
const mockDb: any = {
  collection: jest.fn(() => ({
    findOne: jest.fn(),
    updateOne: jest.fn(),
    find: jest.fn(() => ({
      toArray: jest.fn(),
    })),
    deleteOne: jest.fn(),
  })),
};

describe("executeDeepConsistencyAnalysis Function", () => {
  let cacheServiceInstance: jest.Mocked<CacheService> | any; // Cast to any
  let videoManagementInstance: jest.Mocked<VideoManagementService> | any; // Cast to any

  // Define variables in a broader scope
  let publishedAfterString: string;
  let mockSuccessVideos: youtube_v3.Schema$Video[];
  let genericError: Error;

  const baseMockOptions: FindConsistentOutlierChannelsOptions = {
    query: "test query", // Added required 'query' property
    channelAge: "NEW",
    consistencyLevel: "MODERATE",
    outlierMagnitude: "STANDARD",
    maxResults: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cacheServiceInstance = new MockedCacheService(mockDb); // Pass mockDb to constructor
    videoManagementInstance = new MockedVideoManagementService(); // Use the mocked class

    // Initialize variables for each test
    publishedAfterString = new Date().toISOString();
    genericError = new Error("Network Error");
    mockSuccessVideos = [
      {
        id: "videoS1",
        snippet: {
          publishedAt: "sometime",
          title: "t",
          channelId: "channel1_success", // Use literal string or define const
        },
        statistics: { viewCount: "1" },
      },
    ];

    // Ensure the mock instance methods are set up if not automatically by jest.mock
    if (!videoManagementInstance.fetchChannelRecentTopVideos) {
      videoManagementInstance.fetchChannelRecentTopVideos = jest.fn();
    }
    videoManagementInstance.fetchChannelRecentTopVideos.mockResolvedValue([]);

    mockedAnalysisLogic.isQuotaError.mockReturnValue(false);
    mockedAnalysisLogic.calculateChannelAgePublishedAfter.mockReturnValue(
      publishedAfterString
    ); // Use the initialized variable
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
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1190,
          videoCount: 100,
          viewCount: 100000,
        },
        latestAnalysis: createMockLatestAnalysis({
          subscriberCountAtAnalysis: 1000,
          metrics: {
            STANDARD: { consistencyPercentage: 0.8, outlierVideoCount: 8 },
            STRONG: { consistencyPercentage: 0, outlierVideoCount: 0 }, // Ensure STRONG is present
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
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1100,
          videoCount: 100,
          viewCount: 100000,
        },
        latestAnalysis: createMockLatestAnalysis({
          subscriberCountAtAnalysis: 1000,
          metrics: {
            STANDARD: { consistencyPercentage: 0.6, outlierVideoCount: 6 },
            STRONG: { consistencyPercentage: 0, outlierVideoCount: 0 }, // Ensure STRONG is present
          },
        }),
        status: "analyzed_low_consistency",
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
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1500,
          videoCount: 100,
          viewCount: 100000,
        },
        latestAnalysis: createMockLatestAnalysis({
          // Provide a latestAnalysis that would make it pass growth gate
          subscriberCountAtAnalysis: 1000,
          metrics: {
            STANDARD: { consistencyPercentage: 0.5, outlierVideoCount: 2 },
            STRONG: { consistencyPercentage: 0, outlierVideoCount: 0 }, // Ensure STRONG is present
          },
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
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1100,
          videoCount: 100,
          viewCount: 100000,
        },
        latestAnalysis: createMockLatestAnalysis({
          subscriberCountAtAnalysis: 1000,
          metrics: {
            STANDARD: { consistencyPercentage: 0.6, outlierVideoCount: 5 },
            STRONG: { consistencyPercentage: 0, outlierVideoCount: 0 }, // Ensure STRONG is present
          },
        }),
        status: "analyzed_low_consistency",
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
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1500,
          videoCount: 100,
          viewCount: 100000,
        },
        latestAnalysis: oldAnalysisData,
        status: "analyzed_promising",
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
      expect(updateArg.$set!).toBeDefined();
      expect(
        updateArg.$set!.latestAnalysis!.metrics["STANDARD"]
          .consistencyPercentage
      ).toBe(0.85);
      expect(updateArg.$set!.status).toBe("analyzed_promising");
      expect(updateArg.$push!).toBeDefined();
      expect(updateArg.$push!.analysisHistory).toEqual(oldAnalysisData);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("analyzed_promising");
      expect(
        results[0].latestAnalysis!.metrics.STANDARD.consistencyPercentage
      ).toBe(0.85);
    });

    it("should stop analysis and return quotaExceeded true when API quota is hit", async () => {
      const channelId1 = "channel1_success";
      const channelId2 = "channel2_fail_quota";
      const channel1Data = createMockChannelCache({
        _id: channelId1,
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1000,
          videoCount: 100,
          viewCount: 100000,
        },
        latestAnalysis: undefined, // Changed null to undefined
        status: "candidate",
      });
      const channel2Id = "channel2_fail_quota";
      const channel2Data = createMockChannelCache({
        _id: channel2Id,
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 2000,
          videoCount: 200,
          viewCount: 200000,
        },
        latestAnalysis: undefined, // Changed null to undefined
        status: "candidate",
      });
      const quotaError = new Error("API Quota Exceeded");
      const mockVideosChannel1: youtube_v3.Schema$Video[] = [
        {
          id: "videoC1_1",
          snippet: {
            publishedAt: "sometime",
            title: "t",
            channelId: channel1Data._id, // Use channel1Data._id
          },
          statistics: { viewCount: "1" },
        },
      ];

      mockedAnalysisLogic.calculateChannelAgePublishedAfter.mockReturnValue(
        publishedAfterString
      );

      cacheServiceInstance.findChannelsByIds.mockImplementation(
        async (ids: string[]): Promise<ChannelCache[]> => {
          // Explicitly type ids and return
          const data: ChannelCache[] = [];
          if (ids.includes(channel1Data._id)) data.push(channel1Data);
          if (ids.includes(channel2Data._id)) data.push(channel2Data);
          return data;
        }
      );
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
      const channel2Call = updateCalls.find(
        (call: any) => call[0] === channel2Id
      ); // Cast to any
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
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1000,
          videoCount: 100,
          viewCount: 100000,
        },
        latestAnalysis: undefined, // Changed null to undefined
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
      expect(updatePayload.$set!).toBeDefined();
      expect(updatePayload.$set!.status).toBe("analyzed_low_consistency");
      expect(updatePayload.$set!.latestAnalysis!).toBeDefined();
      expect(
        updatePayload.$set!.latestAnalysis!.metrics.STANDARD
          .consistencyPercentage
      ).toBe(0.5);
      expect(updatePayload.$set!.latestAnalysis!.sourceVideoCount).toBe(
        mockFetchedVideos.length
      );
      expect(
        updatePayload.$set!.latestAnalysis!.subscriberCountAtAnalysis
      ).toBe(mockChannel.latestStats.subscriberCount);

      expect(results).toHaveLength(0); // Channel should not be in promising results
    });

    it("should skip analysis if fetched video list is empty", async () => {
      const channelId = "empty_fetch_channel";
      const mockChannel = createMockChannelCache({
        _id: channelId,
        latestAnalysis: undefined, // Changed null to undefined
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
        latestAnalysis: undefined, // Changed null to undefined
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
        latestAnalysis: undefined, // Changed null to undefined
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1200,
          videoCount: 120,
          viewCount: 120000,
        },
      });
      const channel2Data = createMockChannelCache({
        _id: failChannelId,
        latestAnalysis: undefined, // Changed null to undefined
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1000,
          videoCount: 100,
          viewCount: 100000,
        },
      });

      cacheServiceInstance.findChannelsByIds.mockImplementation(
        async (ids: string[]): Promise<ChannelCache[]> => {
          // Explicitly type ids and return
          const data: ChannelCache[] = [];
          if (ids.includes(channel1Data._id)) data.push(channel1Data);
          if (ids.includes(channel2Data._id)) data.push(channel2Data);
          return data;
        }
      );
      cacheServiceInstance.getVideoListCache.mockResolvedValue(null);

      videoManagementInstance.fetchChannelRecentTopVideos.mockImplementation(
        async (chId, pubAfter) => {
          // Correct signature
          expect(pubAfter).toBe(publishedAfterString); // Verify publishedAfter is passed
          if (chId === channel1Data._id) return mockSuccessVideos; // Use _id for comparison
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
        (call: any) => call[0] === failChannelId
      ); // Cast to any
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
