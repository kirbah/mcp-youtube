import { YoutubeService } from "../../youtube.service";
import { CacheService } from "../../cache.service"; // Import CacheService
import { mocked } from "../../../__tests__/utils/mocks";

// Mock CacheService
jest.mock("../../cache.service");
const MockCacheService = CacheService;

describe("YoutubeService calculatePublishedAfter", () => {
  let youtubeService: YoutubeService;
  let mockCacheService: jest.Mocked<CacheService>;
  const ALLOWED_DRIFT_MS = 5000; // 5 seconds tolerance
  const DUMMY_API_KEY = "dummy-api-key";

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheService = mocked(new MockCacheService());
    youtubeService = new YoutubeService(DUMMY_API_KEY, mockCacheService);
  });

  it("should return an ISO string for pastHour approximately one hour ago", () => {
    const beforeTimestamp = Date.now();
    const result = (youtubeService as any).calculatePublishedAfter("pastHour");
    expect(new Date(result).toISOString()).toBe(result); // Validate ISO string
    const resultTimestamp = new Date(result).getTime();
    const expectedTimestamp = beforeTimestamp - 60 * 60 * 1000;
    expect(resultTimestamp).toBeGreaterThanOrEqual(
      expectedTimestamp - ALLOWED_DRIFT_MS
    );
    // The result should be in the past, so it should be less than or equal to the 'before' time,
    // and also less than or equal to the 'expected' time plus some drift (in case of fast execution).
    expect(resultTimestamp).toBeLessThanOrEqual(
      expectedTimestamp + ALLOWED_DRIFT_MS
    );
  });

  it("should return an ISO string for pastDay approximately one day ago", () => {
    const beforeTimestamp = Date.now();
    const result = (youtubeService as any).calculatePublishedAfter("pastDay");
    expect(new Date(result).toISOString()).toBe(result);
    const resultTimestamp = new Date(result).getTime();
    const expectedTimestamp = beforeTimestamp - 24 * 60 * 60 * 1000;
    expect(resultTimestamp).toBeGreaterThanOrEqual(
      expectedTimestamp - ALLOWED_DRIFT_MS
    );
    expect(resultTimestamp).toBeLessThanOrEqual(
      expectedTimestamp + ALLOWED_DRIFT_MS
    );
  });

  it("should return an ISO string for pastWeek approximately one week ago", () => {
    const beforeTimestamp = Date.now();
    const result = (youtubeService as any).calculatePublishedAfter("pastWeek");
    expect(new Date(result).toISOString()).toBe(result);
    const resultTimestamp = new Date(result).getTime();
    const expectedTimestamp = beforeTimestamp - 7 * 24 * 60 * 60 * 1000;
    expect(resultTimestamp).toBeGreaterThanOrEqual(
      expectedTimestamp - ALLOWED_DRIFT_MS
    );
    expect(resultTimestamp).toBeLessThanOrEqual(
      expectedTimestamp + ALLOWED_DRIFT_MS
    );
  });

  it("should return an ISO string for pastMonth approximately 30 days ago", () => {
    const beforeTimestamp = Date.now();
    const result = (youtubeService as any).calculatePublishedAfter("pastMonth");
    expect(new Date(result).toISOString()).toBe(result);
    const resultTimestamp = new Date(result).getTime();
    const expectedDate = new Date(beforeTimestamp - 30 * 24 * 60 * 60 * 1000);
    expectedDate.setDate(1);
    const expectedTimestamp = expectedDate.getTime();
    expect(resultTimestamp).toBeGreaterThanOrEqual(
      expectedTimestamp - ALLOWED_DRIFT_MS
    );
    expect(resultTimestamp).toBeLessThanOrEqual(
      expectedTimestamp + ALLOWED_DRIFT_MS
    );
  });

  it("should return an ISO string for pastQuarter approximately 90 days ago", () => {
    const beforeTimestamp = Date.now();
    const result = (youtubeService as any).calculatePublishedAfter(
      "pastQuarter"
    );
    expect(new Date(result).toISOString()).toBe(result);
    const resultTimestamp = new Date(result).getTime();
    const expectedDate = new Date(beforeTimestamp - 90 * 24 * 60 * 60 * 1000);
    expectedDate.setDate(1);
    const expectedTimestamp = expectedDate.getTime();
    expect(resultTimestamp).toBeGreaterThanOrEqual(
      expectedTimestamp - ALLOWED_DRIFT_MS
    );
    expect(resultTimestamp).toBeLessThanOrEqual(
      expectedTimestamp + ALLOWED_DRIFT_MS
    );
  });

  it("should return an ISO string for pastYear approximately 365 days ago", () => {
    const beforeTimestamp = Date.now();
    const result = (youtubeService as any).calculatePublishedAfter("pastYear");
    expect(new Date(result).toISOString()).toBe(result);
    const resultTimestamp = new Date(result).getTime();
    const expectedDate = new Date(beforeTimestamp - 365 * 24 * 60 * 60 * 1000);
    expectedDate.setDate(1);
    const expectedTimestamp = expectedDate.getTime();
    expect(resultTimestamp).toBeGreaterThanOrEqual(
      expectedTimestamp - ALLOWED_DRIFT_MS
    );
    expect(resultTimestamp).toBeLessThanOrEqual(
      expectedTimestamp + ALLOWED_DRIFT_MS
    );
  });

  it("should return an empty string for an invalid recency value", () => {
    const result = (youtubeService as any).calculatePublishedAfter(
      "invalidRecencyValue"
    );
    expect(result).toBe("");
  });

  it('should return an empty string for "any" recency value if that means no filter', () => {
    // This test assumes 'any' should result in an empty string, meaning no 'publishedAfter' filter.
    // Adjust if 'any' has a different meaning or if it's not a valid input that leads to empty string.
    const result = (youtubeService as any).calculatePublishedAfter("any");
    expect(result).toBe("");
  });
});
