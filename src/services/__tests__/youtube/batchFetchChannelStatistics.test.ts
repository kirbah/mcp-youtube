import { YoutubeService } from "../../youtube.service"; // Adjusted path
import { CacheService } from "../../cache.service"; // Adjusted path

// Mock googleapis
jest.mock("googleapis", () => {
  const mockChannelsListFn = jest.fn();
  const mockYoutubeInstance = {
    videos: { list: jest.fn() },
    channels: { list: mockChannelsListFn },
    search: { list: jest.fn() },
  };
  return {
    google: {
      youtube: jest.fn(() => mockYoutubeInstance),
    },
    __mockVideosList: jest.fn(),
    __mockChannelsList: mockChannelsListFn,
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
const { __mockChannelsList: mockChannelsList } = jest.requireMock("googleapis");

// Import the CacheService factory
const { CacheService: MockedCacheService } = jest.requireMock(
  "../../cache.service"
); // Adjusted path

describe("YoutubeService - batchFetchChannelStatistics", () => {
  let youtubeService: YoutubeService;
  let mockCacheServiceInstance: jest.Mocked<CacheService>;

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test_api_key";

    mockChannelsList.mockReset();

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
  it("should return an empty map if no channel IDs are provided", async () => {
    const result = await youtubeService.batchFetchChannelStatistics([]);
    expect(result).toEqual(new Map());
    expect(mockChannelsList).not.toHaveBeenCalled();
    expect(youtubeService.getApiCreditsUsed()).toBe(0);
  });

  it("should fetch statistics for a single channel ID", async () => {
    const mockChannelData = {
      id: "channel1",
      snippet: { title: "Channel 1" },
      statistics: { viewCount: "100" },
    };
    mockChannelsList.mockResolvedValueOnce({
      data: { items: [mockChannelData] },
    });

    const result = await youtubeService.batchFetchChannelStatistics([
      "channel1",
    ]);

    expect(mockChannelsList).toHaveBeenCalledWith({
      part: ["snippet", "statistics"],
      id: ["channel1"],
    });
    expect(result.size).toBe(1);
    expect(result.get("channel1")).toEqual(mockChannelData);
    expect(youtubeService.getApiCreditsUsed()).toBe(1);
  });

  it("should fetch statistics for multiple channel IDs in a single batch", async () => {
    const mockChannelData1 = {
      id: "channel1",
      snippet: { title: "Channel 1" },
      statistics: { viewCount: "100" },
    };
    const mockChannelData2 = {
      id: "channel2",
      snippet: { title: "Channel 2" },
      statistics: { viewCount: "200" },
    };
    mockChannelsList.mockResolvedValueOnce({
      data: { items: [mockChannelData1, mockChannelData2] },
    });

    const result = await youtubeService.batchFetchChannelStatistics([
      "channel1",
      "channel2",
    ]);

    expect(mockChannelsList).toHaveBeenCalledWith({
      part: ["snippet", "statistics"],
      id: ["channel1", "channel2"],
    });
    expect(result.size).toBe(2);
    expect(result.get("channel1")).toEqual(mockChannelData1);
    expect(result.get("channel2")).toEqual(mockChannelData2);
    expect(youtubeService.getApiCreditsUsed()).toBe(1);
  });

  it("should fetch statistics for multiple channel IDs in multiple batches", async () => {
    const manyChannelIds = Array.from({ length: 51 }, (_, i) => `channel${i}`);
    const firstBatchIds = manyChannelIds.slice(0, 50);
    const secondBatchIds = manyChannelIds.slice(50);

    const mockResponseItems1 = firstBatchIds.map((id) => ({
      id,
      snippet: { title: id },
      statistics: {},
    }));
    const mockResponseItems2 = secondBatchIds.map((id) => ({
      id,
      snippet: { title: id },
      statistics: {},
    }));

    mockChannelsList
      .mockResolvedValueOnce({ data: { items: mockResponseItems1 } })
      .mockResolvedValueOnce({ data: { items: mockResponseItems2 } });

    const result =
      await youtubeService.batchFetchChannelStatistics(manyChannelIds);

    expect(mockChannelsList).toHaveBeenCalledTimes(2);
    expect(mockChannelsList).toHaveBeenNthCalledWith(1, {
      part: ["snippet", "statistics"],
      id: firstBatchIds,
    });
    expect(mockChannelsList).toHaveBeenNthCalledWith(2, {
      part: ["snippet", "statistics"],
      id: secondBatchIds,
    });
    expect(result.size).toBe(51);
    expect(result.get("channel0")).toEqual(mockResponseItems1[0]);
    expect(result.get("channel50")).toEqual(mockResponseItems2[0]);
    expect(youtubeService.getApiCreditsUsed()).toBe(2);
  });

  it("should handle cases where some channels are not found or API returns partial data", async () => {
    const mockChannelData1 = {
      id: "channel1",
      snippet: { title: "Channel 1" },
      statistics: { viewCount: "100" },
    };
    mockChannelsList.mockResolvedValueOnce({
      data: { items: [mockChannelData1] },
    });

    const result = await youtubeService.batchFetchChannelStatistics([
      "channel1",
      "channel2",
    ]);

    expect(mockChannelsList).toHaveBeenCalledWith({
      part: ["snippet", "statistics"],
      id: ["channel1", "channel2"],
    });
    expect(result.size).toBe(1);
    expect(result.get("channel1")).toEqual(mockChannelData1);
    expect(result.has("channel2")).toBe(false);
    expect(youtubeService.getApiCreditsUsed()).toBe(1);
  });

  it("should throw an error if the API call fails", async () => {
    mockChannelsList.mockRejectedValueOnce(new Error("API Error"));
    await expect(
      youtubeService.batchFetchChannelStatistics(["channel1"])
    ).rejects.toThrow("API call for batchFetchChannelStatistics failed");
    expect(youtubeService.getApiCreditsUsed()).toBe(1);
  });
});
