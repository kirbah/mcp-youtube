import {
  isQuotaError,
  applyStalnessHeuristic,
  STALENESS_DAYS_NEW,
  STALENESS_DAYS_ESTABLISHED,
  calculateDerivedMetrics,
  calculateConsistencyMetrics,
  parseISO8601Duration,
  shouldSkipReAnalysis, // Added this
} from "../analysis.logic";
import type {
  ChannelCache,
  ChannelAnalysisLog,
} from "../../../types/niche.types"; // Added ChannelAnalysisLog
import { youtube_v3 } from "googleapis";

describe("isQuotaError", () => {
  it("should return true for error object with code 403", () => {
    const error = { code: 403, message: "Forbidden" };
    expect(isQuotaError(error)).toBe(true);
  });

  it("should return true for error object with errors array containing quotaExceeded reason", () => {
    const error = {
      errors: [
        { reason: "quotaExceeded", message: "Quota exceeded for service." },
      ],
    };
    expect(isQuotaError(error)).toBe(true);
  });

  it("should return true for error object with code 403 and errors array containing quotaExceeded reason", () => {
    const error = {
      code: 403,
      errors: [
        { reason: "quotaExceeded", message: "Quota exceeded for service." },
      ],
    };
    expect(isQuotaError(error)).toBe(true);
  });

  it("should return false for a generic error object", () => {
    const error = { code: 500, message: "Internal Server Error" };
    expect(isQuotaError(error)).toBe(false);
  });

  it("should return false for an error object with an unrelated reason in errors array", () => {
    const error = {
      errors: [{ reason: "notFound", message: "Resource not found." }],
    };
    expect(isQuotaError(error)).toBe(false);
  });

  it("should return false for a string input", () => {
    const error = "This is not an error object";
    expect(isQuotaError(error)).toBe(false);
  });

  it("should return false for a null input", () => {
    expect(isQuotaError(null)).toBe(false);
  });

  it("should return false for an undefined input", () => {
    expect(isQuotaError(undefined)).toBe(false);
  });

  it("should return false for an empty object", () => {
    expect(isQuotaError({})).toBe(false);
  });

  it("should return false for an object with irrelevant properties", () => {
    const error = {
      message: "Some other error",
      status: 503,
    };
    expect(isQuotaError(error)).toBe(false);
  });
});

describe("applyStalnessHeuristic", () => {
  const MS_IN_DAY = 24 * 60 * 60 * 1000;

  it("should return true if latestAnalysis is undefined", () => {
    const channel: ChannelCache = {
      _id: "channel1",
      channelTitle: "Test Channel",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        fetchedAt: new Date(),
        subscriberCount: 100,
        videoCount: 10,
        viewCount: 1000,
      },
      analysisHistory: [],
      // latestAnalysis is undefined
    };
    expect(applyStalnessHeuristic(channel, "NEW")).toBe(true);
    expect(applyStalnessHeuristic(channel, "ESTABLISHED")).toBe(true);
  });

  it("should return true for NEW channel with analysis older than STALENESS_DAYS_NEW", () => {
    const analysisDate = new Date(
      Date.now() - (STALENESS_DAYS_NEW + 1) * MS_IN_DAY
    );
    const channel: ChannelCache = {
      _id: "channel2",
      channelTitle: "New Channel Stale",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        /* ... */
      } as any,
      analysisHistory: [],
      latestAnalysis: {
        analyzedAt: analysisDate,
        subscriberCountAtAnalysis: 100,
        sourceVideoCount: 10,
        metrics: {} as any,
      },
    };
    expect(applyStalnessHeuristic(channel, "NEW")).toBe(true);
  });

  it("should return false for NEW channel with analysis within STALENESS_DAYS_NEW", () => {
    const analysisDate = new Date(
      Date.now() - (STALENESS_DAYS_NEW - 1) * MS_IN_DAY
    );
    const channel: ChannelCache = {
      _id: "channel3",
      channelTitle: "New Channel Fresh",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        /* ... */
      } as any,
      analysisHistory: [],
      latestAnalysis: {
        analyzedAt: analysisDate,
        subscriberCountAtAnalysis: 100,
        sourceVideoCount: 10,
        metrics: {} as any,
      },
    };
    expect(applyStalnessHeuristic(channel, "NEW")).toBe(false);
  });

  it("should return true for ESTABLISHED channel with analysis older than STALENESS_DAYS_ESTABLISHED", () => {
    const analysisDate = new Date(
      Date.now() - (STALENESS_DAYS_ESTABLISHED + 1) * MS_IN_DAY
    );
    const channel: ChannelCache = {
      _id: "channel4",
      channelTitle: "Established Channel Stale",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        /* ... */
      } as any,
      analysisHistory: [],
      latestAnalysis: {
        analyzedAt: analysisDate,
        subscriberCountAtAnalysis: 1000,
        sourceVideoCount: 100,
        metrics: {} as any,
      },
    };
    expect(applyStalnessHeuristic(channel, "ESTABLISHED")).toBe(true);
  });

  it("should return false for ESTABLISHED channel with analysis within STALENESS_DAYS_ESTABLISHED", () => {
    const analysisDate = new Date(
      Date.now() - (STALENESS_DAYS_ESTABLISHED - 1) * MS_IN_DAY
    );
    const channel: ChannelCache = {
      _id: "channel5",
      channelTitle: "Established Channel Fresh",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        /* ... */
      } as any,
      analysisHistory: [],
      latestAnalysis: {
        analyzedAt: analysisDate,
        subscriberCountAtAnalysis: 1000,
        sourceVideoCount: 100,
        metrics: {} as any,
      },
    };
    expect(applyStalnessHeuristic(channel, "ESTABLISHED")).toBe(false);
  });

  it("should return true for NEW channel with analysis exactly on the threshold (just over)", () => {
    const analysisDate = new Date(
      Date.now() - (STALENESS_DAYS_NEW * MS_IN_DAY + 1)
    ); // 1 millisecond over
    const channel: ChannelCache = {
      _id: "channel6",
      channelTitle: "New Channel Just Stale",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        /* ... */
      } as any,
      analysisHistory: [],
      latestAnalysis: {
        analyzedAt: analysisDate,
        subscriberCountAtAnalysis: 100,
        sourceVideoCount: 10,
        metrics: {} as any,
      },
    };
    expect(applyStalnessHeuristic(channel, "NEW")).toBe(true);
  });

  it("should return false for NEW channel with analysis exactly on the threshold (just under)", () => {
    // Analysis made STALENESS_DAYS_NEW ago, but time component makes it just under the wire
    const analysisDate = new Date(
      Date.now() - STALENESS_DAYS_NEW * MS_IN_DAY + 1000
    ); // Made STALENESS_DAYS_NEW ago, but 1 second "fresher" than "now" at midnight
    const channel: ChannelCache = {
      _id: "channel7",
      channelTitle: "New Channel Just Fresh",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        /* ... */
      } as any,
      analysisHistory: [],
      latestAnalysis: {
        analyzedAt: analysisDate,
        subscriberCountAtAnalysis: 100,
        sourceVideoCount: 10,
        metrics: {} as any,
      },
    };
    expect(applyStalnessHeuristic(channel, "NEW")).toBe(false);
  });
});

describe("calculateDerivedMetrics", () => {
  it("should correctly calculate metrics for a channel with valid stats", () => {
    const channel: ChannelCache = {
      _id: "channel1",
      channelTitle: "Test Channel Valid Stats",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        fetchedAt: new Date(),
        subscriberCount: 1000,
        videoCount: 100,
        viewCount: 500000,
      },
      analysisHistory: [],
    };
    const metrics = calculateDerivedMetrics(channel);
    expect(metrics.historicalAvgViewsPerVideo).toBe(5000); // 500000 / 100
    expect(metrics.libraryEngagementRatio).toBe(500); // 500000 / 1000
  });

  it("should return 0 for historicalAvgViewsPerVideo if videoCount is 0", () => {
    const channel: ChannelCache = {
      _id: "channel2",
      channelTitle: "Test Channel Zero Videos",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        fetchedAt: new Date(),
        subscriberCount: 1000,
        videoCount: 0,
        viewCount: 500000,
      },
      analysisHistory: [],
    };
    const metrics = calculateDerivedMetrics(channel);
    expect(metrics.historicalAvgViewsPerVideo).toBe(0);
    expect(metrics.libraryEngagementRatio).toBe(500); // Should still calculate this
  });

  it("should return 0 for libraryEngagementRatio if subscriberCount is 0", () => {
    const channel: ChannelCache = {
      _id: "channel3",
      channelTitle: "Test Channel Zero Subscribers",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        fetchedAt: new Date(),
        subscriberCount: 0,
        videoCount: 100,
        viewCount: 500000,
      },
      analysisHistory: [],
    };
    const metrics = calculateDerivedMetrics(channel);
    expect(metrics.historicalAvgViewsPerVideo).toBe(5000); // Should still calculate this
    expect(metrics.libraryEngagementRatio).toBe(0);
  });

  it("should return 0 for both metrics if videoCount and subscriberCount are 0", () => {
    const channel: ChannelCache = {
      _id: "channel4",
      channelTitle: "Test Channel Zero Videos Zero Subscribers",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        fetchedAt: new Date(),
        subscriberCount: 0,
        videoCount: 0,
        viewCount: 500000, // viewCount doesn't matter if others are zero for these calcs
      },
      analysisHistory: [],
    };
    const metrics = calculateDerivedMetrics(channel);
    expect(metrics.historicalAvgViewsPerVideo).toBe(0);
    expect(metrics.libraryEngagementRatio).toBe(0);
  });

  it("should return 0 for both metrics if viewCount is 0, even with other stats present", () => {
    const channel: ChannelCache = {
      _id: "channel5",
      channelTitle: "Test Channel Zero Views",
      createdAt: new Date(),
      status: "candidate",
      latestStats: {
        fetchedAt: new Date(),
        subscriberCount: 100,
        videoCount: 10,
        viewCount: 0,
      },
      analysisHistory: [],
    };
    const metrics = calculateDerivedMetrics(channel);
    expect(metrics.historicalAvgViewsPerVideo).toBe(0);
    expect(metrics.libraryEngagementRatio).toBe(0);
  });

  it("should return 0 for both metrics if latestStats is undefined", () => {
    const channel: Partial<ChannelCache> = {
      // Using Partial as latestStats is explicitly missing
      _id: "channel6",
      channelTitle: "Test Channel No Stats",
      // latestStats is undefined
    };
    const metrics = calculateDerivedMetrics(channel as ChannelCache);
    expect(metrics.historicalAvgViewsPerVideo).toBe(0);
    expect(metrics.libraryEngagementRatio).toBe(0);
  });
});

describe("calculateConsistencyMetrics", () => {
  // Helper to create a mock video object
  const createMockVideo = (
    id: string,
    duration: string, // ISO 8601 format e.g., "PT5M30S"
    viewCount: string
  ): youtube_v3.Schema$Video => ({
    id,
    contentDetails: { duration },
    statistics: { viewCount },
  });

  const SUBSCRIBER_COUNT = 1000; // Example subscriber count for thresholds

  it("should return zero metrics for an empty video list", () => {
    const metrics = calculateConsistencyMetrics([], SUBSCRIBER_COUNT);
    expect(metrics.sourceVideoCount).toBe(0);
    expect(metrics.metrics.STANDARD.outlierVideoCount).toBe(0);
    expect(metrics.metrics.STANDARD.consistencyPercentage).toBe(0);
    expect(metrics.metrics.STRONG.outlierVideoCount).toBe(0);
    expect(metrics.metrics.STRONG.consistencyPercentage).toBe(0);
  });

  it("should ignore videos shorter than MIN_VIDEO_DURATION_SECONDS", () => {
    const videos: youtube_v3.Schema$Video[] = [
      createMockVideo("video1", "PT2M59S", "10000"),
      createMockVideo("video2", "PT3M0S", "100"),
    ];
    const metrics = calculateConsistencyMetrics(videos, SUBSCRIBER_COUNT);
    expect(metrics.sourceVideoCount).toBe(1);
    expect(metrics.metrics.STANDARD.outlierVideoCount).toBe(0);
    expect(metrics.metrics.STRONG.outlierVideoCount).toBe(0);
  });

  it("should return zero metrics if all videos are too short", () => {
    const videos: youtube_v3.Schema$Video[] = [
      createMockVideo("video1", "PT1M0S", "50000"),
      createMockVideo("video2", "PT2M0S", "60000"),
    ];
    const metrics = calculateConsistencyMetrics(videos, SUBSCRIBER_COUNT);
    expect(metrics.sourceVideoCount).toBe(0);
    expect(metrics.metrics.STANDARD.outlierVideoCount).toBe(0);
    expect(metrics.metrics.STANDARD.consistencyPercentage).toBe(0);
  });

  it("should correctly calculate metrics for a mixed list of videos", () => {
    const videos: youtube_v3.Schema$Video[] = [
      createMockVideo("video1", "PT5M0S", "500"),
      createMockVideo("video2", "PT4M0S", "1500"),
      createMockVideo("video3", "PT2M59S", "100000"),
      createMockVideo("video4", "PT6M0S", "3500"),
      createMockVideo("video5", "PT10M0S", "200"),
      createMockVideo("video6", "PT3M30S", "999"),
    ];
    const metrics = calculateConsistencyMetrics(videos, SUBSCRIBER_COUNT);
    expect(metrics.sourceVideoCount).toBe(5);
    expect(metrics.metrics.STANDARD.outlierVideoCount).toBe(2);
    expect(metrics.metrics.STANDARD.consistencyPercentage).toBeCloseTo(40);
    expect(metrics.metrics.STRONG.outlierVideoCount).toBe(1);
    expect(metrics.metrics.STRONG.consistencyPercentage).toBeCloseTo(20);
  });

  it("should handle videos with undefined duration or statistics gracefully", () => {
    const videos: any[] = [
      createMockVideo("video1", "PT5M0S", "5000"),
      { id: "video2", contentDetails: {}, statistics: { viewCount: "1000" } },
      { id: "video3", contentDetails: { duration: "PT4M0S" }, statistics: {} },
      { id: "video4" },
    ];
    const metrics = calculateConsistencyMetrics(
      videos as youtube_v3.Schema$Video[],
      SUBSCRIBER_COUNT
    );
    expect(metrics.sourceVideoCount).toBe(1);
    expect(metrics.metrics.STANDARD.outlierVideoCount).toBe(1);
    expect(metrics.metrics.STANDARD.consistencyPercentage).toBe(100);
    expect(metrics.metrics.STRONG.outlierVideoCount).toBe(1);
    expect(metrics.metrics.STRONG.consistencyPercentage).toBe(100);
  });

  it("should not count videos as outliers if their viewCount is less than MIN_OUTLIER_VIEW_COUNT", () => {
    const videos: youtube_v3.Schema$Video[] = [
      createMockVideo("video1", "PT5M0S", "999"),
      createMockVideo("video2", "PT4M0S", "1500"),
    ];
    const metrics = calculateConsistencyMetrics(videos, SUBSCRIBER_COUNT);
    expect(metrics.sourceVideoCount).toBe(2);
    expect(metrics.metrics.STANDARD.outlierVideoCount).toBe(1);
    expect(metrics.metrics.STANDARD.consistencyPercentage).toBeCloseTo(50);
    expect(metrics.metrics.STRONG.outlierVideoCount).toBe(0);
    expect(metrics.metrics.STRONG.consistencyPercentage).toBeCloseTo(0);
  });
});

describe("parseISO8601Duration", () => {
  it("should parse duration with minutes and seconds", () => {
    expect(parseISO8601Duration("PT5M30S")).toBe(330);
  });

  it("should parse duration with only hours", () => {
    expect(parseISO8601Duration("PT1H")).toBe(3600);
  });

  it("should parse duration with only minutes", () => {
    expect(parseISO8601Duration("PT10M")).toBe(600);
  });

  it("should parse duration with only seconds", () => {
    expect(parseISO8601Duration("PT45S")).toBe(45);
  });

  it("should parse duration with hours, minutes, and seconds", () => {
    expect(parseISO8601Duration("PT1H5M30S")).toBe(3930);
  });

  it("should parse duration with hours and minutes only", () => {
    expect(parseISO8601Duration("PT2H15M")).toBe(8100);
  });

  it("should parse duration with hours and seconds only", () => {
    expect(parseISO8601Duration("PT3H45S")).toBe(10845);
  });

  it("should return 0 for an empty string", () => {
    expect(parseISO8601Duration("")).toBe(0);
  });

  it("should return 0 for an invalid format (missing PT)", () => {
    expect(parseISO8601Duration("1H30M")).toBe(0);
  });

  it("should return 0 for an invalid format (wrong characters)", () => {
    expect(parseISO8601Duration("PTXMYSZS")).toBe(0);
  });

  it("should return 0 for a string that only contains PT", () => {
    expect(parseISO8601Duration("PT")).toBe(0);
  });

  it("should return 0 for duration string with days (e.g., P1D)", () => {
    expect(parseISO8601Duration("P1D")).toBe(0);
  });

  it("should return 0 for duration string with days and time (e.g., P1DT12H30M5S)", () => {
    expect(parseISO8601Duration("P1DT12H30M5S")).toBe(0);
  });

  it("should correctly parse if T is not present after P (e.g. P1H - invalid by spec, but testing regex)", () => {
    expect(parseISO8601Duration("P1H")).toBe(0);
  });

  it("should handle missing H, M, or S components correctly", () => {
    expect(parseISO8601Duration("PT1H0M30S")).toBe(3630);
    expect(parseISO8601Duration("PT0H5M0S")).toBe(300);
  });
});

// New tests for shouldSkipReAnalysis
describe("shouldSkipReAnalysis", () => {
  const baseMockChannelStats = {
    fetchedAt: new Date(),
    subscriberCount: 1000,
    videoCount: 100,
    viewCount: 100000,
  };

  // Adjusted to match ChannelAnalysisLog structure (metrics inside an object)
  const baseMockAnalysisHistoryEntry: ChannelAnalysisLog = {
    analyzedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    subscriberCountAtAnalysis: 800,
    sourceVideoCount: 50,
    metrics: {
      // Encapsulating metrics
      STANDARD: { outlierVideoCount: 5, consistencyPercentage: 10 },
      STRONG: { outlierVideoCount: 2, consistencyPercentage: 4 },
    },
  };

  const baseMockLatestAnalysis = { ...baseMockAnalysisHistoryEntry }; // Assuming latestAnalysis also follows ChannelAnalysisLog

  it("should return false if latestAnalysis is undefined", () => {
    const channelData: ChannelCache = {
      _id: "channel1",
      channelTitle: "Test Channel",
      createdAt: new Date(),
      status: "active",
      latestStats: baseMockChannelStats,
      analysisHistory: [baseMockAnalysisHistoryEntry],
      latestAnalysis: undefined, // Test case
    };
    expect(shouldSkipReAnalysis(channelData)).toBe(false);
  });

  it("should return false if analysisHistory is undefined", () => {
    const channelData: Partial<ChannelCache> = {
      // Using Partial as analysisHistory is made undefined for test
      _id: "channel2",
      channelTitle: "Test Channel",
      createdAt: new Date(),
      status: "active",
      latestStats: baseMockChannelStats,
      latestAnalysis: baseMockLatestAnalysis,
      analysisHistory: undefined, // Test case
    };
    expect(shouldSkipReAnalysis(channelData as ChannelCache)).toBe(false);
  });

  it("should return false if analysisHistory is an empty array", () => {
    const channelData: ChannelCache = {
      _id: "channel3",
      channelTitle: "Test Channel",
      createdAt: new Date(),
      status: "active",
      latestStats: baseMockChannelStats,
      latestAnalysis: baseMockLatestAnalysis,
      analysisHistory: [], // Test case
    };
    expect(shouldSkipReAnalysis(channelData)).toBe(false);
  });

  it("should return true if subscriber growth is less than 20% (e.g., 10% growth)", () => {
    const previousSubscribers = 1000;
    const currentSubscribers = 1100; // 10% growth
    const channelData: ChannelCache = {
      _id: "channel4",
      channelTitle: "Test Channel",
      createdAt: new Date(),
      status: "active",
      latestStats: {
        ...baseMockChannelStats,
        subscriberCount: currentSubscribers,
      },
      latestAnalysis: {
        ...baseMockLatestAnalysis,
        subscriberCountAtAnalysis: previousSubscribers,
      }, // Not directly used by func but good for mock completeness
      analysisHistory: [
        {
          ...baseMockAnalysisHistoryEntry,
          subscriberCountAtAnalysis: previousSubscribers,
        },
      ],
    };
    expect(shouldSkipReAnalysis(channelData)).toBe(true);
  });

  it("should return true if subscriber growth is 0%", () => {
    const previousSubscribers = 1000;
    const currentSubscribers = 1000; // 0% growth
    const channelData: ChannelCache = {
      _id: "channel5",
      channelTitle: "Test Channel",
      createdAt: new Date(),
      status: "active",
      latestStats: {
        ...baseMockChannelStats,
        subscriberCount: currentSubscribers,
      },
      latestAnalysis: {
        ...baseMockLatestAnalysis,
        subscriberCountAtAnalysis: previousSubscribers,
      },
      analysisHistory: [
        {
          ...baseMockAnalysisHistoryEntry,
          subscriberCountAtAnalysis: previousSubscribers,
        },
      ],
    };
    expect(shouldSkipReAnalysis(channelData)).toBe(true);
  });

  it("should return true if subscriber growth is negative (e.g., -5%)", () => {
    const previousSubscribers = 1000;
    const currentSubscribers = 950; // -5% growth
    const channelData: ChannelCache = {
      _id: "channel6",
      channelTitle: "Test Channel",
      createdAt: new Date(),
      status: "active",
      latestStats: {
        ...baseMockChannelStats,
        subscriberCount: currentSubscribers,
      },
      latestAnalysis: {
        ...baseMockLatestAnalysis,
        subscriberCountAtAnalysis: previousSubscribers,
      },
      analysisHistory: [
        {
          ...baseMockAnalysisHistoryEntry,
          subscriberCountAtAnalysis: previousSubscribers,
        },
      ],
    };
    expect(shouldSkipReAnalysis(channelData)).toBe(true);
  });

  it("should return false if subscriber growth is exactly 20%", () => {
    const previousSubscribers = 1000;
    const currentSubscribers = 1200; // 20% growth
    const channelData: ChannelCache = {
      _id: "channel7",
      channelTitle: "Test Channel",
      createdAt: new Date(),
      status: "active",
      latestStats: {
        ...baseMockChannelStats,
        subscriberCount: currentSubscribers,
      },
      latestAnalysis: {
        ...baseMockLatestAnalysis,
        subscriberCountAtAnalysis: previousSubscribers,
      },
      analysisHistory: [
        {
          ...baseMockAnalysisHistoryEntry,
          subscriberCountAtAnalysis: previousSubscribers,
        },
      ],
    };
    expect(shouldSkipReAnalysis(channelData)).toBe(false);
  });

  it("should return false if subscriber growth is greater than 20% (e.g., 25%)", () => {
    const previousSubscribers = 1000;
    const currentSubscribers = 1250; // 25% growth
    const channelData: ChannelCache = {
      _id: "channel8",
      channelTitle: "Test Channel",
      createdAt: new Date(),
      status: "active",
      latestStats: {
        ...baseMockChannelStats,
        subscriberCount: currentSubscribers,
      },
      latestAnalysis: {
        ...baseMockLatestAnalysis,
        subscriberCountAtAnalysis: previousSubscribers,
      },
      analysisHistory: [
        {
          ...baseMockAnalysisHistoryEntry,
          subscriberCountAtAnalysis: previousSubscribers,
        },
      ],
    };
    expect(shouldSkipReAnalysis(channelData)).toBe(false);
  });

  it("should return false if previousSubscriberCount in history was 0 and current is > 0 (Infinity growth)", () => {
    const previousSubscribers = 0;
    const currentSubscribers = 100;
    const channelData: ChannelCache = {
      _id: "channel9",
      channelTitle: "Test Channel New",
      createdAt: new Date(),
      status: "active",
      latestStats: {
        ...baseMockChannelStats,
        subscriberCount: currentSubscribers,
      },
      latestAnalysis: {
        ...baseMockLatestAnalysis,
        subscriberCountAtAnalysis: previousSubscribers,
      },
      analysisHistory: [
        {
          ...baseMockAnalysisHistoryEntry,
          subscriberCountAtAnalysis: previousSubscribers,
        },
      ],
    };
    // Growth percentage will be Infinity, which is not < 20.
    expect(shouldSkipReAnalysis(channelData)).toBe(false);
  });

  it("should return false if previousSubscriberCount was 0 and current is also 0 (NaN growth)", () => {
    const previousSubscribers = 0;
    const currentSubscribers = 0;
    const channelData: ChannelCache = {
      _id: "channel10",
      channelTitle: "Test Channel Zero Subs",
      createdAt: new Date(),
      status: "active",
      latestStats: {
        ...baseMockChannelStats,
        subscriberCount: currentSubscribers,
      },
      latestAnalysis: {
        ...baseMockLatestAnalysis,
        subscriberCountAtAnalysis: previousSubscribers,
      },
      analysisHistory: [
        {
          ...baseMockAnalysisHistoryEntry,
          subscriberCountAtAnalysis: previousSubscribers,
        },
      ],
    };
    // Growth percentage will be NaN, which is not < 20.
    expect(shouldSkipReAnalysis(channelData)).toBe(false);
  });

  it("should use the last entry in analysisHistory for calculation", () => {
    const olderAnalysis: ChannelAnalysisLog = {
      ...baseMockAnalysisHistoryEntry,
      subscriberCountAtAnalysis: 500, // Older value
      analyzedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    };
    const lastAnalysisInHistory: ChannelAnalysisLog = {
      ...baseMockAnalysisHistoryEntry,
      subscriberCountAtAnalysis: 900, // This should be used
      analyzedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    };
    const channelData: ChannelCache = {
      _id: "channel11",
      channelTitle: "Test Channel History",
      createdAt: new Date(),
      status: "active",
      latestStats: { ...baseMockChannelStats, subscriberCount: 1000 }, // Current is 1000. (1000-900)/900 * 100 = 11.11%
      latestAnalysis: baseMockLatestAnalysis, // Not directly used by func but good for mock
      analysisHistory: [olderAnalysis, lastAnalysisInHistory],
    };
    expect(shouldSkipReAnalysis(channelData)).toBe(true); // 11.11% is < 20%
  });
});
