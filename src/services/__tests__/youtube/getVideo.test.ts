import { YoutubeService, VideoOptions } from "../../youtube.service";
import { google } from "googleapis";
import { CacheService } from "../../cache.service";

// Mock the googleapis library
jest.mock("googleapis", () => ({
  google: {
    youtube: jest.fn(() => ({
      videos: {
        list: jest.fn(),
      },
    })),
  },
}));

// Mock CacheService at the module level
jest.mock("../../cache.service", () => {
  return {
    CacheService: jest.fn().mockImplementation(() => {
      return {
        getOrSet: jest.fn((key, operation, _ttl, _collection) => operation()),
        createOperationKey: jest.fn(),
      };
    }),
  };
});

describe("YoutubeService.getVideo", () => {
  let youtubeService: YoutubeService;
  let mockYoutubeVideosList: jest.Mock;
  let mockCacheServiceInstance: jest.Mocked<CacheService>; // Use jest.Mocked for better typing

  beforeEach(() => {
    // Reset the mock before each test
    mockYoutubeVideosList = jest.fn();
    (google.youtube as jest.Mock).mockReturnValue({
      videos: {
        list: mockYoutubeVideosList,
      },
    });

    // Get the mocked CacheService instance
    // The constructor of CacheService is mocked, so new CacheService() will return our mock implementation
    mockCacheServiceInstance = new CacheService({} as any); // Pass a dummy db, it won't be used by the mock

    youtubeService = new YoutubeService(mockCacheServiceInstance); // Pass the mocked CacheService instance
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should retrieve video details successfully", async () => {
    const mockVideoId = "testVideoId";
    const mockVideoResponse = {
      data: {
        items: [{ id: mockVideoId, snippet: { title: "Test Video" } }],
      },
    };
    mockYoutubeVideosList.mockResolvedValue(mockVideoResponse);

    const videoOptions: VideoOptions = {
      videoId: mockVideoId,
      parts: ["snippet"],
    };
    const result = await youtubeService.getVideo(videoOptions); // Use youtubeService

    expect(result).toEqual(mockVideoResponse.data.items[0]);
    expect(mockYoutubeVideosList).toHaveBeenCalledWith({
      part: ["snippet"],
      id: [mockVideoId],
    });
    expect(mockCacheServiceInstance.getOrSet).toHaveBeenCalled(); // Verify cache service was called
  });

  it("should return null when no items are returned by the API", async () => {
    const mockVideoId = "nonExistentVideoId";
    mockYoutubeVideosList.mockResolvedValue({ data: { items: [] } });

    const videoOptions: VideoOptions = { videoId: mockVideoId };
    const result = await youtubeService.getVideo(videoOptions); // Use youtubeService

    expect(result).toBeNull(); // Expect null instead of throwing an error
    expect(mockYoutubeVideosList).toHaveBeenCalledWith({
      part: ["snippet"], // Default part
      id: [mockVideoId],
    });
    expect(mockCacheServiceInstance.getOrSet).toHaveBeenCalled();
  });

  it("should throw an error if the YouTube API call fails", async () => {
    const mockVideoId = "testVideoId";
    const errorMessage = "API Error";
    mockYoutubeVideosList.mockRejectedValue(new Error(errorMessage));

    const videoOptions: VideoOptions = { videoId: mockVideoId };

    await expect(youtubeService.getVideo(videoOptions)).rejects.toThrow(
      `YouTube API call for getVideo failed for videoId: ${mockVideoId}`
    );
    expect(mockYoutubeVideosList).toHaveBeenCalledWith({
      part: ["snippet"],
      id: [mockVideoId],
    });
    expect(mockCacheServiceInstance.getOrSet).toHaveBeenCalled();
  });

  it("should request specified parts when provided", async () => {
    const mockVideoId = "testVideoIdWithParts";
    const mockVideoResponse = {
      data: {
        items: [
          {
            id: mockVideoId,
            snippet: { title: "Test Video" },
            statistics: { viewCount: "100" },
          },
        ],
      },
    };
    mockYoutubeVideosList.mockResolvedValue(mockVideoResponse);

    const videoOptions: VideoOptions = {
      videoId: mockVideoId,
      parts: ["snippet", "statistics"],
    };
    await youtubeService.getVideo(videoOptions);

    expect(mockYoutubeVideosList).toHaveBeenCalledWith({
      part: ["snippet", "statistics"],
      id: [mockVideoId],
    });
  });

  it('should use default part "snippet" if no parts are specified', async () => {
    const mockVideoId = "testVideoIdDefaultPart";
    const mockVideoResponse = {
      data: {
        items: [
          { id: mockVideoId, snippet: { title: "Test Video Default Part" } },
        ],
      },
    };
    mockYoutubeVideosList.mockResolvedValue(mockVideoResponse);

    const videoOptions: VideoOptions = { videoId: mockVideoId };
    await youtubeService.getVideo(videoOptions);

    expect(mockYoutubeVideosList).toHaveBeenCalledWith({
      part: ["snippet"], // Default part
      id: [mockVideoId],
    });
  });
});
