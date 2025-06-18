import { executeChannelPreFiltering } from "../phase2-channel-filtering";
import { CacheService } from "../../cache.service";
import { YoutubeService } from "../../../services/youtube.service";
import { NicheRepository } from "../niche.repository"; // Import NicheRepository
import { FindConsistentOutlierChannelsOptions } from "../../../types/analyzer.types";
import { ChannelCache, LatestAnalysis } from "../analysis.types";
import { MAX_SUBSCRIBER_CAP } from "../analysis.logic";
import { MIN_VIDEOS_FOR_ANALYSIS } from "../phase2-channel-filtering";
import { youtube_v3 } from "googleapis";

// --- Mock Setup ---
const mockNicheRepoFindChannelsByIds = jest.fn();
const mockNicheRepoUpdateChannel = jest.fn();
const mockBatchFetchStats = jest.fn();

jest.mock("../../cache.service", () => ({
  CacheService: jest.fn().mockImplementation(() => ({
    // CacheService no longer has findChannelsByIds or updateChannel for channels_cache
  })),
}));

jest.mock("../niche.repository", () => ({
  NicheRepository: jest.fn().mockImplementation(() => ({
    findChannelsByIds: mockNicheRepoFindChannelsByIds,
    updateChannel: mockNicheRepoUpdateChannel,
  })),
}));

jest.mock("../../../services/youtube.service", () => ({
  YoutubeService: jest.fn().mockImplementation(() => ({
    batchFetchChannelStatistics: mockBatchFetchStats,
  })),
}));
// --- End Mock Setup ---

describe("executeChannelPreFiltering", () => {
  let cacheService: CacheService;
  let youtubeService: YoutubeService;
  let nicheRepository: NicheRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService = new CacheService({} as any);
    youtubeService = new YoutubeService({} as any);
    nicheRepository = new NicheRepository({} as any);
  });

  // --- Test Data Helpers ---
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  const fiveMonthsAgo = new Date(
    new Date().setMonth(new Date().getMonth() - 5)
  );
  const eightMonthsAgo = new Date(
    new Date().setMonth(new Date().getMonth() - 8)
  );

  const createMockChannelCache = (
    id: string,
    overrides: Partial<ChannelCache> = {}
  ): ChannelCache => ({
    _id: id,
    channelTitle: `Channel ${id}`,
    createdAt: fiveMonthsAgo,
    status: "candidate",
    latestStats: {
      fetchedAt: new Date(),
      subscriberCount: 5000,
      videoCount: 50,
      viewCount: 500000,
    },
    // FIX: A "fresh" channel must have a `latestAnalysis` object whose `analyzedAt` date is recent.
    // The staleness heuristic checks for the existence of this object first.
    latestAnalysis: {
      analyzedAt: new Date(), // Default to a fresh analysis date
      subscriberCountAtAnalysis: 5000,
      sourceVideoCount: 50,
      metrics: {
        STANDARD: { outlierVideoCount: 0, consistencyPercentage: 0 },
        STRONG: { outlierVideoCount: 0, consistencyPercentage: 0 },
      },
    },
    analysisHistory: [],
    ...overrides,
  });
  // --- End Test Data Helpers ---

  it("should return only valid prospects and correctly update status of filtered channels", async () => {
    // --- ARRANGE ---
    const inputChannelIds = [
      "fresh_and_valid",
      "stale_and_valid",
      "uncached_and_valid",
      "too_large",
      "too_old_for_new",
      "low_potential",
      "low_video_count",
    ];

    const options: FindConsistentOutlierChannelsOptions = {
      query: "test",
      channelAge: "NEW",
      consistencyLevel: "HIGH",
      outlierMagnitude: "STANDARD",
      maxResults: 10,
    };

    const mockCachedDataFromDB: ChannelCache[] = [
      createMockChannelCache("fresh_and_valid"),
      createMockChannelCache("stale_and_valid", {
        // To make a channel stale, we now override the latestAnalysis object
        latestAnalysis: { analyzedAt: fortyDaysAgo } as LatestAnalysis,
      }),
      createMockChannelCache("too_large", {
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: MAX_SUBSCRIBER_CAP + 1,
          videoCount: 50,
          viewCount: 500000,
        },
      }),
      createMockChannelCache("too_old_for_new", { createdAt: eightMonthsAgo }),
      createMockChannelCache("low_potential", {
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 10000,
          videoCount: 20,
          viewCount: 1000,
        },
      }),
      createMockChannelCache("low_video_count", {
        latestStats: {
          fetchedAt: new Date(),
          subscriberCount: 1000,
          videoCount: MIN_VIDEOS_FOR_ANALYSIS - 1,
          viewCount: 500000,
        },
      }),
    ];
    mockNicheRepoFindChannelsByIds.mockResolvedValue(mockCachedDataFromDB);

    const mockFreshStatsFromApi = new Map<string, youtube_v3.Schema$Channel>();
    mockFreshStatsFromApi.set("stale_and_valid", {
      id: "stale_and_valid",
      snippet: { publishedAt: fiveMonthsAgo.toISOString(), title: "Stale" },
      statistics: {
        subscriberCount: "1501",
        videoCount: "26",
        viewCount: "310000",
      },
    });
    mockFreshStatsFromApi.set("uncached_and_valid", {
      id: "uncached_and_valid",
      snippet: { publishedAt: tenDaysAgo.toISOString(), title: "Uncached" },
      statistics: {
        subscriberCount: "500",
        videoCount: "15",
        viewCount: "150000",
      },
    });
    mockBatchFetchStats.mockResolvedValue(mockFreshStatsFromApi);

    // --- ACT ---
    const result = await executeChannelPreFiltering(
      inputChannelIds,
      options,
      youtubeService,
      nicheRepository
    );

    // --- ASSERT ---
    expect(mockBatchFetchStats).toHaveBeenCalledTimes(1);
    expect(mockBatchFetchStats).toHaveBeenCalledWith([
      "stale_and_valid",
      "uncached_and_valid",
    ]);

    expect(mockNicheRepoUpdateChannel).toHaveBeenCalledWith("too_large", {
      $set: { status: "archived_too_large" },
    });
    expect(mockNicheRepoUpdateChannel).toHaveBeenCalledWith("too_old_for_new", {
      $set: { status: "archived_too_old" },
    });
    expect(mockNicheRepoUpdateChannel).toHaveBeenCalledWith("low_potential", {
      $set: { status: "archived_low_potential" },
    });
    expect(mockNicheRepoUpdateChannel).toHaveBeenCalledWith("low_video_count", {
      $set: { status: "archived_low_sample_size" },
    });

    expect(mockNicheRepoUpdateChannel).toHaveBeenCalledWith(
      "stale_and_valid",
      expect.any(Object)
    );
    expect(mockNicheRepoUpdateChannel).toHaveBeenCalledWith(
      "uncached_and_valid",
      expect.any(Object)
    );
    expect(mockNicheRepoUpdateChannel).toHaveBeenCalledTimes(6);

    expect(result).toEqual([
      "fresh_and_valid",
      "stale_and_valid",
      "uncached_and_valid",
    ]);
  });

  it("should not call the API if all channels are fresh from cache and valid", async () => {
    const options: FindConsistentOutlierChannelsOptions = {
      query: "t",
      channelAge: "NEW",
      consistencyLevel: "HIGH",
      outlierMagnitude: "STANDARD",
      maxResults: 10,
    };

    const freshChannel1 = createMockChannelCache("fresh1");
    const freshChannel2 = createMockChannelCache("fresh2");

    mockNicheRepoFindChannelsByIds.mockResolvedValue([
      freshChannel1,
      freshChannel2,
    ]);

    const result = await executeChannelPreFiltering(
      ["fresh1", "fresh2"],
      options,
      youtubeService,
      nicheRepository
    );

    expect(mockBatchFetchStats).not.toHaveBeenCalled();
    expect(mockNicheRepoUpdateChannel).not.toHaveBeenCalled();
    expect(result).toEqual(["fresh1", "fresh2"]);
  });

  it("should correctly filter for ESTABLISHED channels", async () => {
    const options: FindConsistentOutlierChannelsOptions = {
      query: "t",
      channelAge: "ESTABLISHED",
      consistencyLevel: "HIGH",
      outlierMagnitude: "STANDARD",
      maxResults: 10,
    };

    const newChannel = createMockChannelCache("new_channel", {
      createdAt: fiveMonthsAgo,
    }); // Too young
    const establishedChannel = createMockChannelCache("established_channel", {
      createdAt: eightMonthsAgo,
    }); // Valid

    mockNicheRepoFindChannelsByIds.mockResolvedValue([
      newChannel,
      establishedChannel,
    ]);

    const result = await executeChannelPreFiltering(
      ["new_channel", "established_channel"],
      options,
      youtubeService,
      nicheRepository
    );

    expect(mockNicheRepoUpdateChannel).toHaveBeenCalledTimes(1);
    expect(mockNicheRepoUpdateChannel).toHaveBeenCalledWith("new_channel", {
      $set: { status: "archived_too_old" },
    });
    expect(result).toEqual(["established_channel"]);
  });
});
