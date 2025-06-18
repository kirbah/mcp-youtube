import { YoutubeService } from "../../youtube.service";
import { getSubtitles } from "youtube-captions-scraper";
import { CacheService } from "../../cache.service";

// Mock the entire CacheService module
jest.mock("../../cache.service", () => {
  return {
    CacheService: jest.fn().mockImplementation(() => {
      return {
        createOperationKey: jest.fn(),
        getOrSet: jest.fn(),
      };
    }),
  };
});

// Mock youtube-captions-scraper and ensure getSubtitles is a Jest mock
jest.mock("youtube-captions-scraper", () => ({
  getSubtitles: jest.fn(),
}));

// Cast getSubtitles to JestMockedFunction for easier mocking
const mockGetSubtitles = getSubtitles;

describe("YoutubeService.getTranscript", () => {
  let videoManagement: YoutubeService;
  let MockCacheService: jest.Mock; // Reference to the mocked constructor
  let mockCacheServiceInstance: jest.Mocked<CacheService>; // Instance of the mocked service

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Get the mocked CacheService constructor
    MockCacheService = CacheService as jest.Mock;

    // Get the instance created by the constructor
    mockCacheServiceInstance =
      new MockCacheService() as jest.Mocked<CacheService>;

    // Set up mock implementations for the methods used in this test
    mockCacheServiceInstance.createOperationKey.mockImplementation(
      (operationName, params) => JSON.stringify({ operationName, params })
    );
    mockCacheServiceInstance.getOrSet.mockImplementation(
      (key, operation, ttl, collection) => operation()
    );

    // Initialize YoutubeService instance with the mocked CacheService instance
    videoManagement = new YoutubeService(mockCacheServiceInstance);
  });

  it("should retrieve transcript successfully with specified language", async () => {
    const videoId = "testVideoId";
    const lang = "es";
    const mockTranscript = [{ text: "Hola mundo" }];
    mockGetSubtitles.mockResolvedValue(mockTranscript);

    const result = await videoManagement.getTranscript(videoId, lang);

    expect(mockGetSubtitles).toHaveBeenCalledWith({ videoID: videoId, lang });
    expect(result).toEqual(mockTranscript);
  });

  it('should use default language "en" when lang is not provided', async () => {
    const videoId = "testVideoIdEn";
    const mockTranscript = [{ text: "Hello world" }];
    mockGetSubtitles.mockResolvedValue(mockTranscript);
    const result = await videoManagement.getTranscript(videoId);

    expect(mockGetSubtitles).toHaveBeenCalledWith({
      videoID: videoId,
      lang: "en",
    });
    expect(result).toEqual(mockTranscript);
  });

  it("should throw an error if getSubtitles fails", async () => {
    const videoId = "testVideoIdError";
    const errorMessage = "Failed to fetch captions";
    mockGetSubtitles.mockRejectedValue(new Error(errorMessage));

    await expect(videoManagement.getTranscript(videoId)).rejects.toThrow(
      `API call for getTranscript failed for videoId: ${videoId}`
    );
    expect(mockGetSubtitles).toHaveBeenCalledWith({
      videoID: videoId,
      lang: "en",
    }); // Assumes 'en' as fallback
  });
});
