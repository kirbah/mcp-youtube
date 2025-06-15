import { executeInitialCandidateSearch } from "../phase1-candidate-search";
import { CacheService } from "../../cache.service";
import { VideoManagement } from "../../../functions/videos";
import { FindConsistentOutlierChannelsOptions } from "../../../types/analyzer.types";
import { youtube_v3 } from "googleapis";

// Mock CacheService
jest.mock("../../cache.service");
const MockedCacheService = CacheService as jest.MockedClass<
  typeof CacheService
>;

// Mock VideoManagement
jest.mock("../../../functions/videos");
const MockedVideoManagement = VideoManagement as jest.MockedClass<
  typeof VideoManagement
>;

describe("executeInitialCandidateSearch", () => {
  let mockCacheService: jest.Mocked<CacheService>;
  let mockVideoManagement: jest.Mocked<VideoManagement>;
  let defaultOptions: FindConsistentOutlierChannelsOptions;

  beforeEach(() => {
    // Reset mocks before each test
    MockedCacheService.mockClear();
    MockedVideoManagement.mockClear();

    // Create new instances of mocked services for each test
    mockCacheService = new MockedCacheService() as jest.Mocked<CacheService>;
    mockVideoManagement =
      new MockedVideoManagement() as jest.Mocked<VideoManagement>;

    defaultOptions = {
      query: "test query",
      channelAge: "NEW", // Default to no age restriction
      consistencyLevel: "MODERATE",
      outlierMagnitude: "STANDARD",
      maxResults: 50,
    };
  });

  it("should return cached results if available and not call videoManagement.searchVideos", async () => {
    const cachedResults: youtube_v3.Schema$SearchResult[] = [
      { snippet: { channelId: "channel1" } },
      { snippet: { channelId: "channel2" } },
    ];
    const expectedChannelIds = ["channel1", "channel2"];

    // Mock getCachedSearchResults to return cached data
    mockCacheService.getCachedSearchResults.mockResolvedValue(cachedResults);

    const result = await executeInitialCandidateSearch(
      defaultOptions,
      mockCacheService,
      mockVideoManagement
    );

    // Assertions
    expect(mockCacheService.getCachedSearchResults).toHaveBeenCalledTimes(1);
    expect(mockVideoManagement.searchVideos).not.toHaveBeenCalled();
    expect(mockCacheService.storeCachedSearchResults).not.toHaveBeenCalled(); // Should not be called if cache hit
    expect(result).toEqual(expect.arrayContaining(expectedChannelIds));
    expect(result.length).toBe(expectedChannelIds.length);
  });

  it("should fetch results using videoManagement.searchVideos if not in cache and then store them", async () => {
    const fetchedResults: youtube_v3.Schema$SearchResult[] = [
      { snippet: { channelId: "channel3" } },
      { snippet: { channelId: "channel4" } },
      { snippet: { channelId: "channel3" } }, // Duplicate to test Set behavior
    ];
    const expectedChannelIds = ["channel3", "channel4"];

    // Mock getCachedSearchResults to return null (cache miss)
    mockCacheService.getCachedSearchResults.mockResolvedValue(null);
    // Mock searchVideos to return fetched data
    mockVideoManagement.searchVideos.mockResolvedValue(fetchedResults);
    // Mock storeCachedSearchResults to resolve successfully
    mockCacheService.storeCachedSearchResults.mockResolvedValue();

    const result = await executeInitialCandidateSearch(
      defaultOptions,
      mockCacheService,
      mockVideoManagement
    );

    // Assertions
    expect(mockCacheService.getCachedSearchResults).toHaveBeenCalledTimes(1);
    expect(mockVideoManagement.searchVideos).toHaveBeenCalledTimes(1);
    expect(mockVideoManagement.searchVideos).toHaveBeenCalledWith({
      query: defaultOptions.query,
      publishedAfter: expect.any(String), // We trust calculateChannelAgePublishedAfter from its own tests
      type: "video",
      order: "relevance",
      maxResults: 50,
      regionCode: undefined, // Based on defaultOptions
      videoCategoryId: undefined, // Based on defaultOptions
    });
    expect(mockCacheService.storeCachedSearchResults).toHaveBeenCalledTimes(1);
    expect(mockCacheService.storeCachedSearchResults).toHaveBeenCalledWith(
      expect.objectContaining({
        q: defaultOptions.query,
        // Other params are tested by their presence in searchParams
      }),
      fetchedResults
    );
    expect(result).toEqual(expect.arrayContaining(expectedChannelIds));
    expect(result.length).toBe(expectedChannelIds.length);
  });

  it("should throw a user-friendly quota error if videoManagement.searchVideos fails with quota error", async () => {
    // Mock getCachedSearchResults to return null (cache miss)
    mockCacheService.getCachedSearchResults.mockResolvedValue(null);

    // Mock searchVideos to throw a Google API quota error
    const quotaError = {
      code: 403,
      errors: [{ reason: "quotaExceeded", message: "Quota exceeded." }],
    };
    mockVideoManagement.searchVideos.mockRejectedValue(quotaError);

    // Assertions
    await expect(
      executeInitialCandidateSearch(
        defaultOptions,
        mockCacheService,
        mockVideoManagement
      )
    ).rejects.toThrow("YouTube API quota exceeded during Phase 1.");

    expect(mockCacheService.getCachedSearchResults).toHaveBeenCalledTimes(1);
    expect(mockVideoManagement.searchVideos).toHaveBeenCalledTimes(1);
    expect(mockCacheService.storeCachedSearchResults).not.toHaveBeenCalled(); // Should not be called if search fails
  });

  it("should throw a generic phase 1 error if videoManagement.searchVideos fails with a non-quota error", async () => {
    // Mock getCachedSearchResults to return null (cache miss)
    mockCacheService.getCachedSearchResults.mockResolvedValue(null);

    // Mock searchVideos to throw a generic error
    const genericError = new Error("Some other API error");
    mockVideoManagement.searchVideos.mockRejectedValue(genericError);

    // Assertions
    await expect(
      executeInitialCandidateSearch(
        defaultOptions,
        mockCacheService,
        mockVideoManagement
      )
    ).rejects.toThrow("Phase 1 failed: Some other API error");

    expect(mockCacheService.getCachedSearchResults).toHaveBeenCalledTimes(1);
    expect(mockVideoManagement.searchVideos).toHaveBeenCalledTimes(1);
    expect(mockCacheService.storeCachedSearchResults).not.toHaveBeenCalled();
  });

  it("should correctly extract unique channel IDs from search results", async () => {
    const searchResultsWithDuplicates: youtube_v3.Schema$SearchResult[] = [
      { snippet: { channelId: "channel1" } },
      { snippet: { channelId: "channel2" } },
      { snippet: { channelId: "channel1" } }, // Duplicate
      { snippet: { channelId: "channel3" } },
      { snippet: { channelId: "channel2" } }, // Duplicate
      { snippet: {} }, // No channelId
      { snippet: { channelId: undefined } }, // Undefined channelId
    ];
    const expectedChannelIds = ["channel1", "channel2", "channel3"];

    mockCacheService.getCachedSearchResults.mockResolvedValue(null);
    mockVideoManagement.searchVideos.mockResolvedValue(
      searchResultsWithDuplicates
    );
    mockCacheService.storeCachedSearchResults.mockResolvedValue();

    const result = await executeInitialCandidateSearch(
      defaultOptions,
      mockCacheService,
      mockVideoManagement
    );

    expect(result).toEqual(expect.arrayContaining(expectedChannelIds));
    expect(result.length).toBe(expectedChannelIds.length);
  });

  it("should pass optional parameters like regionCode and videoCategoryId to searchVideos", async () => {
    const optionsWithExtras: FindConsistentOutlierChannelsOptions = {
      ...defaultOptions,
      regionCode: "US",
      videoCategoryId: "10",
      channelAge: "ESTABLISHED", // Example to ensure publishedAfter is calculated
    };

    mockCacheService.getCachedSearchResults.mockResolvedValue(null);
    mockVideoManagement.searchVideos.mockResolvedValue([]); // No results needed for this test
    mockCacheService.storeCachedSearchResults.mockResolvedValue();

    await executeInitialCandidateSearch(
      optionsWithExtras,
      mockCacheService,
      mockVideoManagement
    );

    expect(mockVideoManagement.searchVideos).toHaveBeenCalledWith({
      query: optionsWithExtras.query,
      publishedAfter: expect.any(String), // We trust calculateChannelAgePublishedAfter
      type: "video",
      order: "relevance",
      maxResults: 50,
      regionCode: "US", // Check this
      videoCategoryId: "10", // Check this
    });
    // Also check that these are passed to storeCachedSearchResults
    expect(mockCacheService.storeCachedSearchResults).toHaveBeenCalledWith(
      expect.objectContaining({
        q: optionsWithExtras.query,
        publishedAfter: expect.any(String),
        regionCode: "US",
        videoCategoryId: "10",
      }),
      []
    );
  });
});
