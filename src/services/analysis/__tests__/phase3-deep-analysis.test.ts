import { CacheService } from "../../cache.service";
import { YoutubeService as VideoManagementService } from "../../youtube.service.js";
import { NicheRepository } from "../niche.repository";
import * as analysisLogic from "../analysis.logic";
import { getDb } from "../../database.service.js";
import { executeDeepConsistencyAnalysis } from "../phase3-deep-analysis";
import { FindConsistentOutlierChannelsOptions } from "../../../types/analyzer.types";
import { ChannelCache, LatestAnalysis } from "../../../types/niche.types";
import { youtube_v3 } from "googleapis";
import { CACHE_COLLECTIONS } from "../../../config/cache.config";

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

  const final = { ...defaults, ...overrides };

  // Ensure latestStats is fully merged
  if (overrides.latestStats) {
    final.latestStats = { ...defaults.latestStats, ...overrides.latestStats };
  }

  // Handle latestAnalysis explicitly
  if (Object.prototype.hasOwnProperty.call(overrides, "latestAnalysis")) {
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

// Mock the MongoDB Db object
const mockCollectionMethods = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
  find: jest.fn(() => ({
    toArray: jest.fn(),
  })),
  deleteOne: jest.fn(),
};

const mockDb: any = {
  collection: jest.fn(() => mockCollectionMethods), // Always return the same mock methods
};

// Mock database service
jest.mock("../../database.service.js", () => ({
  getDb: jest.fn(),
}));

// Mock CacheService
jest.mock("../../cache.service", () => {
  const actualCacheService = jest.requireActual(
    "../../cache.service"
  ).CacheService;
  return {
    CacheService: jest.fn().mockImplementation(() => {
      const instance = new actualCacheService(); // No db in constructor
      jest.spyOn(instance, "createOperationKey");
      jest.spyOn(instance, "getOrSet");

      // For testing, we want getOrSet to either return a mocked cached value
      // or execute the operation, but using our mockDb.
      instance.getOrSet.mockImplementation(
        async (
          key: string,
          operation: () => Promise<unknown>,
          ttl: number,
          collection: string,
          params?: object
        ) => {
          // Simulate a cache hit using mockDb
          const cachedResult = await mockDb
            .collection(`${instance["CACHE_COLLECTION_PREFIX"]}${collection}`)
            .findOne({
              _id: key,
              expiresAt: { $gt: new Date() },
            });

          if (cachedResult) {
            return cachedResult.data;
          }
          return operation();
        }
      );

      return instance;
    }),
  };
});
const MockedCacheService = CacheService;

// Mock NicheRepository
jest.mock("../niche.repository", () => {
  return {
    NicheRepository: jest.fn().mockImplementation(() => ({
      findChannelsByIds: jest.fn(),
      updateChannel: jest.fn(),
    })),
  };
});
const MockedNicheRepository = NicheRepository;

// Mock VideoManagementService
jest.mock("../../youtube.service.ts", () => {
  // We need to mock the actual implementation to use the CacheService mock
  const actualYoutubeService = jest.requireActual(
    "../../youtube.service.ts"
  ).YoutubeService;

  return {
    YoutubeService: jest.fn().mockImplementation((cacheService: any) => {
      const instance = new actualYoutubeService(cacheService);
      jest.spyOn(instance, "fetchChannelRecentTopVideos");

      // Mock the internal youtube API calls that fetchChannelRecentTopVideos makes
      // This is crucial when getOrSet's operation() is executed
      instance.youtube = {
        search: {
          list: jest.fn(),
        },
        videos: {
          list: jest.fn(),
        },
      };

      // Default mock for youtube.search.list and youtube.videos.list
      // These can be overridden by specific tests if needed
      instance.youtube.search.list.mockResolvedValue({
        data: { items: [] },
      });
      instance.youtube.videos.list.mockResolvedValue({
        data: { items: [] },
      });

      return instance;
    }),
  };
});
const MockedVideoManagementService = VideoManagementService as jest.MockedClass<
  typeof VideoManagementService
>;

// Mock analysis.logic functions
jest.mock("../analysis.logic");
const mockedAnalysisLogic = analysisLogic as jest.Mocked<typeof analysisLogic>;

describe("executeDeepConsistencyAnalysis Function", () => {
  let cacheServiceInstance: CacheService; // Changed to non-mocked type as it's not directly mocked here
  let videoManagementInstance: jest.Mocked<VideoManagementService>;
  let nicheRepositoryInstance: jest.Mocked<NicheRepository>;

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
    // Reset mocks for each test
    (getDb as jest.Mock).mockResolvedValue(mockDb);

    // cacheServiceInstance is no longer directly used by executeDeepConsistencyAnalysis,
    // but it's still needed for the YoutubeService constructor if we were not mocking YoutubeService fully.
    // Since YoutubeService is fully mocked, cacheServiceInstance is not strictly needed here for the test itself.
    // However, keeping it for consistency with the mock setup of YoutubeService.
    cacheServiceInstance = new MockedCacheService();
    videoManagementInstance = new MockedVideoManagementService(
      cacheServiceInstance
    ) as jest.Mocked<VideoManagementService>; // YoutubeService now takes CacheService
    nicheRepositoryInstance = new MockedNicheRepository();

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

    // Reset the mock implementation for fetchChannelRecentTopVideos for each test
    // No need to mock fetchChannelRecentTopVideos here directly,
    // as the YoutubeService mock now uses the actual implementation
    // which will interact with the mocked cacheServiceInstance.
    // We just need to ensure cacheServiceInstance is set up for the test.

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
    nicheRepositoryInstance.findChannelsByIds.mockResolvedValue([]);
    await expect(
      executeDeepConsistencyAnalysis(
        [],
        baseMockOptions,
        videoManagementInstance, // Removed cacheServiceInstance
        nicheRepositoryInstance
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
      nicheRepositoryInstance.findChannelsByIds.mockResolvedValue([
        mockChannel,
      ]);
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7); // 0.8 > 0.7

      const { results } = await executeDeepConsistencyAnalysis(
        ["channel1"],
        baseMockOptions,
        videoManagementInstance, // Removed cacheServiceInstance
        nicheRepositoryInstance
      );

      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).not.toHaveBeenCalled();
      expect(nicheRepositoryInstance.updateChannel).not.toHaveBeenCalled();
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
      nicheRepositoryInstance.findChannelsByIds.mockResolvedValue([
        mockChannel,
      ]);
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7); // 0.6 < 0.7

      const { results } = await executeDeepConsistencyAnalysis(
        ["channel1"],
        baseMockOptions,
        videoManagementInstance, // Removed cacheServiceInstance
        nicheRepositoryInstance
      );
      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).not.toHaveBeenCalled();
      expect(nicheRepositoryInstance.updateChannel).not.toHaveBeenCalled();
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

      nicheRepositoryInstance.findChannelsByIds.mockResolvedValue([
        mockChannel,
      ]);
      // Mock the findOne call on the mocked db collection to simulate a cache hit
      mockDb
        .collection(
          `${cacheServiceInstance["CACHE_COLLECTION_PREFIX"]}${CACHE_COLLECTIONS.CHANNEL_RECENT_TOP_VIDEOS}`
        )
        .findOne.mockResolvedValue({
          _id: cacheServiceInstance.createOperationKey(
            "fetchChannelRecentTopVideos",
            { channelId: "channel2", publishedAfter: publishedAfterString }
          ),
          data: mockVideos,
          expiresAt: new Date(Date.now() + 10000), // Future date
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
        videoManagementInstance,
        nicheRepositoryInstance
      );

      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledTimes(1);
      expect(
        mockDb.collection(
          `${cacheServiceInstance["CACHE_COLLECTION_PREFIX"]}${CACHE_COLLECTIONS.CHANNEL_RECENT_TOP_VIDEOS}`
        ).findOne
      ).toHaveBeenCalledTimes(1); // Ensure cache was checked via findOne
      expect(nicheRepositoryInstance.updateChannel).toHaveBeenCalledTimes(1); // Should be called once to update the channel
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
      nicheRepositoryInstance.findChannelsByIds.mockResolvedValue([
        mockChannel,
      ]);
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7);

      await executeDeepConsistencyAnalysis(
        ["channel-no-growth"],
        baseMockOptions,
        videoManagementInstance, // Removed cacheServiceInstance
        nicheRepositoryInstance
      );
      // Since YoutubeService is mocked to handle caching internally,
      // fetchChannelRecentTopVideos should not be called if the growth gate fails.
      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).not.toHaveBeenCalled();
      expect(
        mockDb.collection(
          `${cacheServiceInstance["CACHE_COLLECTION_PREFIX"]}${CACHE_COLLECTIONS.CHANNEL_RECENT_TOP_VIDEOS}`
        ).findOne
      ).not.toHaveBeenCalled(); // Cache should not be checked either
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

      nicheRepositoryInstance.findChannelsByIds.mockResolvedValue([
        mockChannel,
      ]);
      // Mock YoutubeService's fetchChannelRecentTopVideos to return newMockVideos
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
        videoManagementInstance, // Removed cacheServiceInstance
        nicheRepositoryInstance
      );

      expect(nicheRepositoryInstance.updateChannel).toHaveBeenCalledTimes(1);
      const updateArg = nicheRepositoryInstance.updateChannel.mock.calls[0][1];
      expect(updateArg.$set).toBeDefined();
      expect(
        updateArg.$set!.latestAnalysis!.metrics["STANDARD"]
          .consistencyPercentage
      ).toBe(0.85);
      expect(updateArg.$set!.status).toBe("analyzed_promising");
      expect(updateArg.$push).toBeDefined();
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

      nicheRepositoryInstance.findChannelsByIds.mockImplementation(
        async (ids: string[]): Promise<ChannelCache[]> => {
          // Explicitly type ids and return
          const data: ChannelCache[] = [];
          if (ids.includes(channel1Data._id)) data.push(channel1Data);
          if (ids.includes(channel2Data._id)) data.push(channel2Data);
          return data;
        }
      );

      // Mock YoutubeService's fetchChannelRecentTopVideos to simulate quota error
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
        videoManagementInstance, // Removed cacheServiceInstance
        nicheRepositoryInstance
      );

      expect(quotaExceeded).toBe(true);
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe(channelId1);
      expect(results[0].status).toBe("analyzed_promising");
      expect(nicheRepositoryInstance.updateChannel).toHaveBeenCalledTimes(1);
      expect(nicheRepositoryInstance.updateChannel).toHaveBeenCalledWith(
        channelId1,
        expect.anything()
      );

      const updateCalls = nicheRepositoryInstance.updateChannel.mock.calls;
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

      nicheRepositoryInstance.findChannelsByIds.mockResolvedValue([
        mockChannel,
      ]);
      // Trigger new fetch by mocking YoutubeService directly
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

      nicheRepositoryInstance.updateChannel.mockResolvedValue(undefined); // Mock a successful void promise

      const publishedAfterString = new Date().toISOString();
      mockedAnalysisLogic.calculateChannelAgePublishedAfter.mockReturnValue(
        publishedAfterString
      );

      const { results } = await executeDeepConsistencyAnalysis(
        [channelId],
        baseMockOptions, // Uses 'STANDARD' and consistencyLevel 'MODERATE' (threshold 0.7)
        videoManagementInstance, // Removed cacheServiceInstance
        nicheRepositoryInstance
      );

      expect(nicheRepositoryInstance.updateChannel).toHaveBeenCalledTimes(1);
      const [updatedChannelId, updatePayload] =
        nicheRepositoryInstance.updateChannel.mock.calls[0];

      expect(updatedChannelId).toBe(channelId);
      expect(updatePayload.$set).toBeDefined();
      expect(updatePayload.$set!.status).toBe("analyzed_low_consistency");
      expect(updatePayload.$set!.latestAnalysis).toBeDefined();
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

      nicheRepositoryInstance.findChannelsByIds.mockResolvedValue([
        mockChannel,
      ]);
      // Explicitly mock fetchChannelRecentTopVideos to return an empty array for this test
      videoManagementInstance.fetchChannelRecentTopVideos.mockResolvedValue([]);

      // Removed console.errorSpy as per user's instruction

      const publishedAfterString = new Date().toISOString();
      mockedAnalysisLogic.calculateChannelAgePublishedAfter.mockReturnValue(
        publishedAfterString
      );

      const { results } = await executeDeepConsistencyAnalysis(
        [channelId],
        baseMockOptions,
        videoManagementInstance,
        nicheRepositoryInstance
      );

      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledTimes(1);
      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledWith(channelId, publishedAfterString);

      expect(
        mockedAnalysisLogic.calculateConsistencyMetrics
      ).not.toHaveBeenCalled();
      expect(nicheRepositoryInstance.updateChannel).not.toHaveBeenCalled();
      expect(results).toHaveLength(0);

      // Removed console.errorSpy.mockRestore();
    });

    it("should skip analysis if cached video list is empty", async () => {
      const channelId = "empty_cache_channel";
      const mockChannel = createMockChannelCache({
        _id: channelId,
        latestAnalysis: undefined,
        status: "candidate",
      });

      nicheRepositoryInstance.findChannelsByIds.mockResolvedValue([
        mockChannel,
      ]);
      // Simulate cache hit with an empty video list by mocking the findOne call on the mocked db collection
      mockDb
        .collection(
          `${cacheServiceInstance["CACHE_COLLECTION_PREFIX"]}${CACHE_COLLECTIONS.CHANNEL_RECENT_TOP_VIDEOS}`
        )
        .findOne.mockResolvedValue({
          _id: cacheServiceInstance.createOperationKey(
            "fetchChannelRecentTopVideos",
            { channelId: channelId, publishedAfter: publishedAfterString }
          ),
          data: [], // Empty cached list
          expiresAt: new Date(Date.now() + 10000), // Future date
        });

      // Removed console.errorSpy as per user's instruction

      const { results } = await executeDeepConsistencyAnalysis(
        [channelId],
        baseMockOptions,
        videoManagementInstance,
        nicheRepositoryInstance
      );

      expect(
        videoManagementInstance.fetchChannelRecentTopVideos
      ).toHaveBeenCalledTimes(1);
      expect(
        mockDb.collection(
          `${cacheServiceInstance["CACHE_COLLECTION_PREFIX"]}${CACHE_COLLECTIONS.CHANNEL_RECENT_TOP_VIDEOS}`
        ).findOne
      ).toHaveBeenCalledTimes(1); // Ensure cache was checked via findOne
      expect(
        mockedAnalysisLogic.calculateConsistencyMetrics
      ).not.toHaveBeenCalled();
      expect(nicheRepositoryInstance.updateChannel).not.toHaveBeenCalled();
      expect(results).toHaveLength(0);

      // Removed console.errorSpy.mockRestore();
    });

    it("should continue if a generic error occurs during video fetch", async () => {
      const successChannelId = "channel_generic_success";
      const failChannelId = "channel_generic_fail";

      const channel1Data = createMockChannelCache({
        _id: successChannelId,
        latestAnalysis: undefined,
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1200,
          videoCount: 120,
          viewCount: 120000,
        },
      });
      const channel2Data = createMockChannelCache({
        _id: failChannelId,
        latestAnalysis: undefined,
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1000,
          videoCount: 100,
          viewCount: 100000,
        },
      });

      nicheRepositoryInstance.findChannelsByIds.mockImplementation(
        async (ids: string[]): Promise<ChannelCache[]> => {
          const data: ChannelCache[] = [];
          if (ids.includes(channel1Data._id)) data.push(channel1Data);
          if (ids.includes(channel2Data._id)) data.push(channel2Data);
          return data;
        }
      );

      videoManagementInstance.fetchChannelRecentTopVideos.mockImplementation(
        async (chId, pubAfter) => {
          expect(pubAfter).toBe(publishedAfterString);
          if (chId === channel1Data._id) return mockSuccessVideos;
          if (chId === failChannelId) throw genericError;
          return [];
        }
      );

      mockedAnalysisLogic.isQuotaError.mockImplementation(
        (err) => err !== genericError
      );

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
          return {
            sourceVideoCount: 0,
            metrics: {
              STANDARD: { consistencyPercentage: 0, outlierVideoCount: 0 },
              STRONG: { consistencyPercentage: 0, outlierVideoCount: 0 },
            },
          };
        }
      );
      mockedAnalysisLogic.getConsistencyThreshold.mockReturnValue(0.7);

      // Removed console.errorSpy as per user's instruction

      const { results, quotaExceeded } = await executeDeepConsistencyAnalysis(
        [successChannelId, failChannelId],
        baseMockOptions,
        videoManagementInstance,
        nicheRepositoryInstance
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

      expect(nicheRepositoryInstance.updateChannel).toHaveBeenCalledTimes(1);
      expect(nicheRepositoryInstance.updateChannel).toHaveBeenCalledWith(
        successChannelId,
        expect.anything()
      );

      const updateCalls = nicheRepositoryInstance.updateChannel.mock.calls;
      const failChannelUpdateCall = updateCalls.find(
        (call: any) => call[0] === failChannelId
      );
      expect(failChannelUpdateCall).toBeUndefined();

      expect(quotaExceeded).toBe(false);
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe(successChannelId);
      expect(results[0].status).toBe("analyzed_promising");

      // Removed console.errorSpy.mockRestore();
    });
  });
});
