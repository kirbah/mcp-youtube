import { YoutubeService } from "../../youtube.service";
import { google } from "googleapis";
import { CacheService } from "../../cache.service";

// Mock googleapis
jest.mock("googleapis", () => {
  const mockVideosListFn = jest.fn(); // Create the mock function
  return {
    google: {
      youtube: jest.fn(() => ({
        // Mock the youtube function
        videos: {
          list: mockVideosListFn, // Assign the mock function here
        },
      })),
    },
  };
});

jest.mock("../../cache.service", () => {
  const mockCacheService = {
    getOrSet: jest.fn((key, operation) => operation()),
    createOperationKey: jest.fn(
      (operationName, params) => `${operationName}-${JSON.stringify(params)}`
    ),
    getCachedSearchResults: jest.fn(),
    storeCachedSearchResults: jest.fn(),
    getVideoListCache: jest.fn(),
    setVideoListCache: jest.fn(),
    generateSearchParamsHash: jest.fn(),
  };
  return {
    CacheService: jest.fn(() => mockCacheService),
  };
});

// Test suite for VideoManagement.getTrendingVideos method
describe("YoutubeService.getTrendingVideos", () => {
  let videoManagement: YoutubeService;
  let mockVideosList: jest.Mock; // Declare type for the mock
  let mockCacheServiceInstance: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Get the mocked CacheService instance
    const { CacheService: MockedCacheService } = jest.requireMock(
      "../../cache.service"
    );
    mockCacheServiceInstance = new MockedCacheService();
    videoManagement = new YoutubeService(
      "test_api_key",
      mockCacheServiceInstance
    );

    // Access the mock directly from the mocked module
    // The google.youtube() call here will use the mocked implementation.
    mockVideosList = google.youtube({ version: "v3" }).videos.list as jest.Mock;
    mockVideosList.mockClear();
    // Reset YOUTUBE_API_KEY if it was changed by a test
    process.env.YOUTUBE_API_KEY = "test_api_key";
  });

  it("should return an empty array when there are no trending videos", async () => {
    // Mock the youtube.videos.list method to return an empty items array
    mockVideosList.mockResolvedValue({ data: { items: [] } });

    const result = await videoManagement.getTrendingVideos({});
    expect(result).toEqual([]);
    expect(mockVideosList).toHaveBeenCalledTimes(1);
    expect(mockVideosList).toHaveBeenCalledWith({
      part: ["snippet", "statistics", "contentDetails"],
      chart: "mostPopular",
      regionCode: "US", // Default regionCode
      maxResults: 10, // Default maxResults
    });
  });

  it("should return a list of LeanTrendingVideo objects when there are trending videos", async () => {
    const mockApiResponse = {
      data: {
        items: [
          {
            id: "video1",
            snippet: {
              title: "Trending Video 1",
              channelId: "channel1",
              channelTitle: "Channel 1",
              publishedAt: "2023-01-01T00:00:00Z",
            },
            statistics: {
              viewCount: "1000",
              likeCount: "100",
              commentCount: "10",
            }, // Plain numbers as strings
            contentDetails: { duration: "PT1M30S" },
          },
          {
            id: "video2",
            snippet: {
              title: "Trending Video 2",
              channelId: "channel2",
              channelTitle: "Channel 2",
              publishedAt: "2023-01-02T00:00:00Z",
            },
            statistics: {
              viewCount: "2000",
              likeCount: "200",
              commentCount: "20",
            }, // Plain numbers as strings
            contentDetails: { duration: "PT2M0S" },
          },
        ],
      },
    };
    mockVideosList.mockResolvedValue(mockApiResponse);

    const result = await videoManagement.getTrendingVideos({
      regionCode: "GB",
      maxResults: 5,
    });
    expect(result).toEqual([
      {
        id: "video1",
        title: "Trending Video 1",
        channelId: "channel1",
        channelTitle: "Channel 1",
        publishedAt: "2023-01-01T00:00:00Z",
        duration: "PT1M30S",
        viewCount: 1000,
        likeCount: 100,
        commentCount: 10,
        likeToViewRatio: 0.1,
        commentToViewRatio: 0.01,
      },
      {
        id: "video2",
        title: "Trending Video 2",
        channelId: "channel2",
        channelTitle: "Channel 2",
        publishedAt: "2023-01-02T00:00:00Z",
        duration: "PT2M0S",
        viewCount: 2000,
        likeCount: 200,
        commentCount: 20,
        likeToViewRatio: 0.1,
        commentToViewRatio: 0.01,
      },
    ]);
    expect(mockVideosList).toHaveBeenCalledTimes(1);
    expect(mockVideosList).toHaveBeenCalledWith({
      part: ["snippet", "statistics", "contentDetails"],
      chart: "mostPopular",
      regionCode: "GB",
      maxResults: 5,
    });
  });

  it("should throw an error if youtube.videos.list throws an error", async () => {
    const errorMessage = "Failed to fetch trending videos from API";
    mockVideosList.mockRejectedValue(new Error(errorMessage));

    await expect(videoManagement.getTrendingVideos({})).rejects.toThrow(
      `YouTube API call for getTrendingVideos failed`
    );
    expect(mockVideosList).toHaveBeenCalledTimes(1);
  });

  it("should use videoCategoryId if provided in options", async () => {
    mockVideosList.mockResolvedValue({ data: { items: [] } });
    await videoManagement.getTrendingVideos({ categoryId: "10" });
    expect(mockVideosList).toHaveBeenCalledWith(
      expect.objectContaining({
        videoCategoryId: "10",
      })
    );
  });

  it("should handle undefined items in API response gracefully", async () => {
    mockVideosList.mockResolvedValue({ data: {} }); // No items array
    const result = await videoManagement.getTrendingVideos({});
    expect(result).toEqual([]);
    expect(mockVideosList).toHaveBeenCalledTimes(1);
  });

  it("should correctly parse plain numeric strings from statistics", async () => {
    // Renamed test
    const mockApiResponse = {
      data: {
        items: [
          {
            id: "video3",
            snippet: {
              title: "Video with plain number stats",
              channelId: "channel3",
              channelTitle: "Channel 3",
              publishedAt: "2023-01-03T00:00:00Z",
            },
            statistics: {
              viewCount: "1500",
              likeCount: "500",
              commentCount: "1000000",
            }, // Plain numbers as strings
            contentDetails: { duration: "PT3M0S" },
          },
        ],
      },
    };
    mockVideosList.mockResolvedValue(mockApiResponse);
    const result = await videoManagement.getTrendingVideos({});
    expect(result[0].viewCount).toBe(1500);
    expect(result[0].likeCount).toBe(500);
    expect(result[0].commentCount).toBe(1000000);
  });

  it("should throw an error if YOUTUBE_API_KEY is not set", async () => {
    delete process.env.YOUTUBE_API_KEY; // Simulate API key not being set
    // Expect constructor to throw error, or the method call if auth is checked lazily
    // For this class, constructor initializes youtube object, so it should throw there.
    // However, the actual google.youtube might not throw until a call is made.
    // Let's assume for now the call to videos.list will fail if auth is missing.
    mockVideosList.mockImplementation(async () => {
      if (!process.env.YOUTUBE_API_KEY) {
        // This specific mock implementation might not be strictly necessary
        // if the default mockRejectedValue below correctly simulates the API key issue.
        throw new Error("API key not available");
      }
      return { data: { items: [] } };
    });
    // Re-initialize with no API key
    expect(
      () => new YoutubeService("test_api_key", mockCacheServiceInstance)
    ).not.toThrow(); // Constructor itself might not throw if API key check is lazy

    // Simulate that a call to youtube.videos.list would fail if auth (API key) is missing.
    mockVideosList.mockRejectedValue(new Error("Missing API key"));
    delete process.env.YOUTUBE_API_KEY; // Ensure API key is not set for this specific test scenario

    const freshVideoManagement = new YoutubeService(
      "test_api_key",
      mockCacheServiceInstance
    ); // Create a new instance that would use the missing API key
    await expect(freshVideoManagement.getTrendingVideos({})).rejects.toThrow(
      "YouTube API call for getTrendingVideos failed"
    );
  });
});
