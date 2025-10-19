import { YoutubeService } from "../../youtube.service"; // Adjusted path
import { CacheService } from "../../cache.service"; // Adjusted path

// Mock googleapis
jest.mock("googleapis", () => {
  const mockVideosListFn = jest.fn();
  // We only need videos.list for API credit tests related to getVideo
  const mockYoutubeInstance = {
    videos: { list: mockVideosListFn },
    channels: { list: jest.fn() }, // Keep other mocks available if YoutubeService constructor uses them
    search: { list: jest.fn() },
  };
  return {
    google: {
      youtube: jest.fn(() => mockYoutubeInstance),
    },
    __mockVideosList: mockVideosListFn,
    // Export other mocks even if not used by this specific suite, for consistency if YoutubeService init needs them
    __mockChannelsList: jest.fn(),
    __mockSearchList: jest.fn(),
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
const { __mockVideosList: mockVideosList } = jest.requireMock("googleapis");

// Import the CacheService factory
const { CacheService: MockedCacheService } = jest.requireMock(
  "../../cache.service"
); // Adjusted path

describe("YoutubeService - API Credit Usage", () => {
  let youtubeService: YoutubeService;
  let mockCacheServiceInstance: jest.Mocked<CacheService>;

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test_api_key";

    mockVideosList.mockReset();

    mockCacheServiceInstance =
      new MockedCacheService() as jest.Mocked<CacheService>;
    mockCacheServiceInstance.getOrSet.mockImplementation(
      (cacheKey, operation) => operation()
    );

    youtubeService = new YoutubeService(
      "test_api_key",
      mockCacheServiceInstance
    );
    youtubeService.resetApiCreditsUsed();
  });

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
  });

  // Tests for getApiCreditsUsed, resetApiCreditsUsed, and credit increment
  it("should return 0 API credits used initially", () => {
    expect(youtubeService.getApiCreditsUsed()).toBe(0);
  });

  it("should reset API credits used", async () => {
    mockVideosList.mockResolvedValueOnce({
      data: { items: [{ id: "videoId" }] },
    });
    await youtubeService.getVideo({ videoId: "videoId" });

    youtubeService.resetApiCreditsUsed();
    expect(youtubeService.getApiCreditsUsed()).toBe(0);
  });

  it("should increment API credits after an API call (getVideo)", async () => {
    mockVideosList
      .mockResolvedValueOnce({ data: { items: [{ id: "testVideo" }] } })
      .mockResolvedValueOnce({ data: { items: [{ id: "testVideo2" }] } });

    await youtubeService.getVideo({ videoId: "testVideo" });
    expect(youtubeService.getApiCreditsUsed()).toBe(1); // Cost of videos.list is 1

    await youtubeService.getVideo({ videoId: "testVideo2" });
    expect(youtubeService.getApiCreditsUsed()).toBe(2); // Incremented
  });
});
