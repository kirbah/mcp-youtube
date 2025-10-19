import { YoutubeService } from "../../youtube.service";
import { google } from "googleapis";
import { CacheService } from "../../cache.service";

jest.mock("googleapis", () => {
  const mockChannelsList = jest.fn();
  return {
    google: {
      youtube: jest.fn(() => ({
        channels: {
          list: mockChannelsList,
        },
      })),
    },
    // Export the mock function so we can manipulate it in tests
    __mockChannelsList: mockChannelsList,
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

// Destructure the mock function for easier access in tests
const { __mockChannelsList: mockChannelsList } = jest.requireMock("googleapis");

describe("YoutubeService.getChannelStatistics", () => {
  let youtubeService: YoutubeService;
  let mockCacheServiceInstance: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Reset the mock before each test
    mockChannelsList.mockReset();
    // Set the required environment variable
    process.env.YOUTUBE_API_KEY = "test_api_key";

    // Get the mocked CacheService instance
    const { CacheService: MockedCacheService } = jest.requireMock(
      "../../cache.service"
    );
    mockCacheServiceInstance = new MockedCacheService();
    youtubeService = new YoutubeService(
      "test_api_key",
      mockCacheServiceInstance
    );
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.YOUTUBE_API_KEY;
  });

  it("should retrieve and process channel statistics correctly", async () => {
    const mockChannelData = {
      items: [
        {
          snippet: {
            title: "Test Channel",
            publishedAt: "2023-01-01T00:00:00Z",
          },
          statistics: {
            subscriberCount: "1000",
            viewCount: "100000",
            videoCount: "100",
          },
        },
      ],
    };
    mockChannelsList.mockResolvedValueOnce({ data: mockChannelData });

    const stats = await youtubeService.getChannelStatistics("test_channel_id");

    expect(stats).toEqual({
      channelId: "test_channel_id",
      title: "Test Channel",
      subscriberCount: 1000,
      viewCount: 100000,
      videoCount: 100,
      createdAt: "2023-01-01T00:00:00Z",
    });
    expect(google.youtube).toHaveBeenCalledWith({
      version: "v3",
      auth: "test_api_key",
    });
    expect(mockChannelsList).toHaveBeenCalledWith({
      part: ["snippet", "statistics"],
      id: ["test_channel_id"],
    });
  });

  it("should throw an error if channel is not found", async () => {
    mockChannelsList.mockResolvedValueOnce({ data: { items: [] } });

    await expect(
      youtubeService.getChannelStatistics("unknown_channel_id")
    ).rejects.toThrow(
      "YouTube API call for getChannelStatistics failed for channelId: unknown_channel_id"
    );
  });

  it("should throw an error if API call fails", async () => {
    mockChannelsList.mockRejectedValueOnce(new Error("API Error"));

    await expect(
      youtubeService.getChannelStatistics("test_channel_id")
    ).rejects.toThrow(
      "YouTube API call for getChannelStatistics failed for channelId: test_channel_id"
    );
  });
});
