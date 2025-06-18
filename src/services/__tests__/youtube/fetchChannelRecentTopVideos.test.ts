import { YoutubeService } from "../../youtube.service"; // Adjusted path
import { CacheService } from "../../cache.service"; // Adjusted path

// Mock googleapis
jest.mock("googleapis", () => {
  const mockVideosListFn = jest.fn();
  const mockSearchListFn = jest.fn();
  const mockYoutubeInstance = {
    videos: { list: mockVideosListFn },
    channels: { list: jest.fn() },
    search: { list: mockSearchListFn },
  };
  return {
    google: {
      youtube: jest.fn(() => mockYoutubeInstance),
    },
    __mockVideosList: mockVideosListFn,
    __mockChannelsList: jest.fn(),
    __mockSearchList: mockSearchListFn,
  };
});

// Mock CacheService
jest.mock("../../cache.service", () => {
  // Adjusted path
  const mockCacheInstanceInternal = {
    getOrSet: jest.fn(),
    createOperationKey: jest.fn(
      (operationName, params) => `${operationName}-${JSON.stringify(params)}`
    ),
  };
  return {
    CacheService: jest.fn(() => mockCacheInstanceInternal),
  };
});

// Import the specific mocks for googleapis
const { __mockVideosList: mockVideosList, __mockSearchList: mockSearchList } =
  jest.requireMock("googleapis");

// Import the CacheService factory
const { CacheService: MockedCacheService } = jest.requireMock(
  "../../cache.service"
); // Adjusted path

describe("YoutubeService - fetchChannelRecentTopVideos", () => {
  let youtubeService: YoutubeService;
  let mockCacheServiceInstance: jest.Mocked<CacheService>;

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test_api_key";

    mockVideosList.mockReset();
    mockSearchList.mockReset();

    mockCacheServiceInstance =
      new MockedCacheService() as jest.Mocked<CacheService>;
    mockCacheServiceInstance.getOrSet.mockImplementation(
      (cacheKey, operation) => operation()
    );

    youtubeService = new YoutubeService(mockCacheServiceInstance);
    youtubeService.resetApiCreditsUsed();
  });

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
  });

  // Copied from the original youtube.service.test.ts
  it("should fetch recent top videos for a channel", async () => {
    const channelId = "channel1";
    const publishedAfter = "2023-01-01T00:00:00Z";
    const mockSearchItems = [
      { id: { videoId: "video1" } },
      { id: { videoId: "video2" } },
    ];
    const mockVideoItems = [
      {
        id: "video1",
        statistics: { viewCount: "1000" },
        contentDetails: { duration: "PT1M" },
      },
      {
        id: "video2",
        statistics: { viewCount: "2000" },
        contentDetails: { duration: "PT2M" },
      },
    ];

    mockSearchList.mockResolvedValueOnce({
      data: { items: mockSearchItems, nextPageToken: undefined },
    });
    mockVideosList.mockResolvedValueOnce({
      data: { items: mockVideoItems },
    });

    const result = await youtubeService.fetchChannelRecentTopVideos(
      channelId,
      publishedAfter
    );

    expect(mockSearchList).toHaveBeenCalledWith({
      channelId: channelId,
      part: ["snippet"],
      order: "viewCount",
      maxResults: 50,
      publishedAfter: publishedAfter,
      type: ["video"],
      pageToken: undefined,
    });
    expect(mockVideosList).toHaveBeenCalledWith({
      part: ["statistics", "contentDetails"],
      id: ["video1", "video2"],
    });
    expect(result).toEqual(mockVideoItems);
    expect(youtubeService.getApiCreditsUsed()).toBe(101);
  });

  it("should return an empty array if search returns no videos", async () => {
    const channelId = "channel2";
    const publishedAfter = "2023-01-01T00:00:00Z";
    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });

    const result = await youtubeService.fetchChannelRecentTopVideos(
      channelId,
      publishedAfter
    );

    expect(mockSearchList).toHaveBeenCalledTimes(1);
    expect(mockVideosList).not.toHaveBeenCalled();
    expect(result).toEqual([]);
    expect(youtubeService.getApiCreditsUsed()).toBe(100);
  });

  it("should return an empty array if video details fetch returns no items", async () => {
    const channelId = "channel3";
    const publishedAfter = "2023-01-01T00:00:00Z";
    const mockSearchItems = [{ id: { videoId: "video3" } }];

    mockSearchList.mockResolvedValueOnce({
      data: { items: mockSearchItems },
    });
    mockVideosList.mockResolvedValueOnce({ data: { items: [] } });

    const result = await youtubeService.fetchChannelRecentTopVideos(
      channelId,
      publishedAfter
    );

    expect(mockSearchList).toHaveBeenCalledTimes(1);
    expect(mockVideosList).toHaveBeenCalledWith({
      part: ["statistics", "contentDetails"],
      id: ["video3"],
    });
    expect(result).toEqual([]);
    expect(youtubeService.getApiCreditsUsed()).toBe(101);
  });

  it("should filter out undefined video IDs from search results before fetching video details", async () => {
    const channelId = "channel4";
    const publishedAfter = "2023-01-01T00:00:00Z";
    const mockSearchItems = [
      { id: { videoId: "video4" } },
      { id: {} },
      { id: { videoId: "video5" } },
    ];
    const mockVideoItems = [
      {
        id: "video4",
        statistics: { viewCount: "100" },
        contentDetails: { duration: "PT1M" },
      },
      {
        id: "video5",
        statistics: { viewCount: "200" },
        contentDetails: { duration: "PT1M" },
      },
    ];

    mockSearchList.mockResolvedValueOnce({
      data: { items: mockSearchItems },
    });
    mockVideosList.mockResolvedValueOnce({
      data: { items: mockVideoItems },
    });

    await youtubeService.fetchChannelRecentTopVideos(channelId, publishedAfter);

    expect(mockVideosList).toHaveBeenCalledWith({
      part: ["statistics", "contentDetails"],
      id: ["video4", "video5"],
    });
    expect(youtubeService.getApiCreditsUsed()).toBe(101);
  });

  it("should throw an error if search.list API call fails", async () => {
    const channelId = "channel5";
    const publishedAfter = "2023-01-01T00:00:00Z";
    mockSearchList.mockRejectedValueOnce(new Error("Search API Error"));

    await expect(
      youtubeService.fetchChannelRecentTopVideos(channelId, publishedAfter)
    ).rejects.toThrow(
      `Failed to fetch recent top videos for channel ${channelId}: Search API Error`
    );
    expect(youtubeService.getApiCreditsUsed()).toBe(100);
  });

  it("should throw an error if videos.list API call fails", async () => {
    const channelId = "channel6";
    const publishedAfter = "2023-01-01T00:00:00Z";
    const mockSearchItems = [{ id: { videoId: "video6" } }];

    mockSearchList.mockResolvedValueOnce({
      data: { items: mockSearchItems },
    });
    mockVideosList.mockRejectedValueOnce(new Error("Videos API Error"));

    await expect(
      youtubeService.fetchChannelRecentTopVideos(channelId, publishedAfter)
    ).rejects.toThrow(
      `Failed to fetch recent top videos for channel ${channelId}: Videos API Error`
    );
    expect(youtubeService.getApiCreditsUsed()).toBe(101);
  });
});
