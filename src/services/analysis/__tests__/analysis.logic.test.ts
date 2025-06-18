import {
  isQuotaError,
  applyStalnessHeuristic,
  STALENESS_DAYS_NEW,
  STALENESS_DAYS_ESTABLISHED,
  calculateDerivedMetrics,
  calculateConsistencyMetrics,
  parseISO8601Duration,
} from "../analysis.logic";
import type { ChannelCache } from "../../../types/niche.types";
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
    // The function expects a ChannelCache, but its internal logic for latestStats handles undefined well.
    // However, the function signature expects channel.latestStats to be present.
    // The current implementation of calculateDerivedMetrics accesses channel.latestStats?.videoCount
    // which means it will not crash if latestStats is undefined, and will return 0s.
    // To make TypeScript happy for the test setup, we can cast or modify the input type slightly for the test.
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
      createMockVideo("video1", "PT2M59S", "10000"), // Just under 3 minutes (179s)
      createMockVideo("video2", "PT3M0S", "100"), // Exactly 3 minutes (180s) - counts
    ];
    // parseISO8601Duration('PT2M59S') = 179
    // parseISO8601Duration('PT3M0S') = 180
    // MIN_VIDEO_DURATION_SECONDS is 180, so video1 is skipped.

    const metrics = calculateConsistencyMetrics(videos, SUBSCRIBER_COUNT);
    expect(metrics.sourceVideoCount).toBe(1); // Only video2 is counted
    // Assuming MIN_OUTLIER_VIEW_COUNT is 1000. video2 has 100 views, so it's not an outlier.
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
    // MIN_OUTLIER_VIEW_COUNT = 1000
    // STANDARD threshold: SUBSCRIBER_COUNT * 1 = 1000
    // STRONG threshold: SUBSCRIBER_COUNT * 3 = 3000
    const videos: youtube_v3.Schema$Video[] = [
      createMockVideo("video1", "PT5M0S", "500"), // Long enough, but views < 1000 (MIN_OUTLIER_VIEW_COUNT) -> not outlier
      createMockVideo("video2", "PT4M0S", "1500"), // Long enough, views > 1000, views > STANDARD (1000) -> STANDARD outlier
      // views < STRONG (3000) -> not STRONG outlier
      createMockVideo("video3", "PT2M59S", "100000"), // Too short, ignored
      createMockVideo("video4", "PT6M0S", "3500"), // Long enough, views > 1000, views > STANDARD (1000), views > STRONG (3000) -> STANDARD & STRONG outlier
      createMockVideo("video5", "PT10M0S", "200"), // Long enough, but views < 1000 -> not outlier
      createMockVideo("video6", "PT3M30S", "999"), // Long enough, but views < 1000 -> not outlier
    ];
    // parseISO8601Duration('PT2M59S') = 179. MIN_VIDEO_DURATION_SECONDS = 180.
    // Long form videos: video1, video2, video4, video5, video6. Count = 5.
    // Standard outliers: video2 (1500), video4 (3500). Count = 2.
    // Strong outliers: video4 (3500). Count = 1.

    const metrics = calculateConsistencyMetrics(videos, SUBSCRIBER_COUNT);
    expect(metrics.sourceVideoCount).toBe(5);

    expect(metrics.metrics.STANDARD.outlierVideoCount).toBe(2);
    expect(metrics.metrics.STANDARD.consistencyPercentage).toBeCloseTo(
      (2 / 5) * 100
    ); // 40%

    expect(metrics.metrics.STRONG.outlierVideoCount).toBe(1);
    expect(metrics.metrics.STRONG.consistencyPercentage).toBeCloseTo(
      (1 / 5) * 100
    ); // 20%
  });

  it("should handle videos with undefined duration or statistics gracefully", () => {
    const videos: any[] = [
      // Using 'any' to allow malformed objects for testing robustness
      createMockVideo("video1", "PT5M0S", "5000"), // Valid
      { id: "video2", contentDetails: {}, statistics: { viewCount: "1000" } }, // Missing duration
      { id: "video3", contentDetails: { duration: "PT4M0S" }, statistics: {} }, // Missing viewCount
      { id: "video4" }, // Missing contentDetails and statistics
    ];
    // Only video1 should be processed.
    const metrics = calculateConsistencyMetrics(
      videos as youtube_v3.Schema$Video[],
      SUBSCRIBER_COUNT
    );
    expect(metrics.sourceVideoCount).toBe(1);
    // video1: 5000 views. STANDARD threshold = 1000, STRONG threshold = 3000. Is STANDARD and STRONG.
    expect(metrics.metrics.STANDARD.outlierVideoCount).toBe(1);
    expect(metrics.metrics.STANDARD.consistencyPercentage).toBe(100);
    expect(metrics.metrics.STRONG.outlierVideoCount).toBe(1);
    expect(metrics.metrics.STRONG.consistencyPercentage).toBe(100);
  });

  it("should not count videos as outliers if their viewCount is less than MIN_OUTLIER_VIEW_COUNT", () => {
    // MIN_OUTLIER_VIEW_COUNT = 1000
    // STANDARD threshold: SUBSCRIBER_COUNT * 1 = 1000
    // STRONG threshold: SUBSCRIBER_COUNT * 3 = 3000
    const videos: youtube_v3.Schema$Video[] = [
      createMockVideo("video1", "PT5M0S", "999"), // Long enough, but views < MIN_OUTLIER_VIEW_COUNT
      createMockVideo("video2", "PT4M0S", "1500"), // Long enough, views >= MIN_OUTLIER_VIEW_COUNT, views > STANDARD -> STANDARD outlier
    ];
    // Long form videos: video1, video2. Count = 2.
    // Standard outliers: video2 (1500). Count = 1.
    // Strong outliers: None.

    const metrics = calculateConsistencyMetrics(videos, SUBSCRIBER_COUNT);
    expect(metrics.sourceVideoCount).toBe(2);

    expect(metrics.metrics.STANDARD.outlierVideoCount).toBe(1);
    expect(metrics.metrics.STANDARD.consistencyPercentage).toBeCloseTo(
      (1 / 2) * 100
    ); // 50%

    expect(metrics.metrics.STRONG.outlierVideoCount).toBe(0);
    expect(metrics.metrics.STRONG.consistencyPercentage).toBeCloseTo(0);
  });
});

describe("parseISO8601Duration", () => {
  it("should parse duration with minutes and seconds", () => {
    expect(parseISO8601Duration("PT5M30S")).toBe(330); // 5*60 + 30
  });

  it("should parse duration with only hours", () => {
    expect(parseISO8601Duration("PT1H")).toBe(3600); // 1*60*60
  });

  it("should parse duration with only minutes", () => {
    expect(parseISO8601Duration("PT10M")).toBe(600); // 10*60
  });

  it("should parse duration with only seconds", () => {
    expect(parseISO8601Duration("PT45S")).toBe(45);
  });

  it("should parse duration with hours, minutes, and seconds", () => {
    expect(parseISO8601Duration("PT1H5M30S")).toBe(3930); // 3600 + 5*60 + 30
  });

  it("should parse duration with hours and minutes only", () => {
    expect(parseISO8601Duration("PT2H15M")).toBe(8100); // 2*3600 + 15*60
  });

  it("should parse duration with hours and seconds only", () => {
    expect(parseISO8601Duration("PT3H45S")).toBe(10845); // 3*3600 + 45
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
    expect(parseISO8601Duration("P1D")).toBe(0); // Does not start with PT for time
  });

  it("should return 0 for duration string with days and time (e.g., P1DT12H30M5S)", () => {
    // The regex is PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?
    // It requires the string to start with "PT". "P1DT..." does not.
    expect(parseISO8601Duration("P1DT12H30M5S")).toBe(0);
  });

  it("should correctly parse if T is not present after P (e.g. P1H - invalid by spec, but testing regex)", () => {
    // ISO 8601 duration for time requires "PT" prefix.
    // The regex ^PT... enforces this. So "P1H" should not match.
    expect(parseISO8601Duration("P1H")).toBe(0);
  });

  it("should handle missing H, M, or S components correctly", () => {
    expect(parseISO8601Duration("PT1H0M30S")).toBe(3630); // 1*3600 + 0*60 + 30
    expect(parseISO8601Duration("PT0H5M0S")).toBe(300); // 0*3600 + 5*60 + 0
  });
});
