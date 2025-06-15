/* eslint-env node */
/* eslint-parser-options project: ["./tsconfig.test.json"] */
import { getChannelStatisticsHandler } from "../getChannelStatistics";
import { formatSuccess } from "../../../utils/responseFormatter"; // Corrected import path
import { formatError } from "../../../utils/errorHandler"; // Corrected import path
import { YoutubeService } from "../../../services/youtube.service"; // Import the actual class

// Mock the entire YoutubeService module
jest.mock("../../../services/youtube.service", () => {
  // Use a factory function to return the mocked class
  const mockYoutubeService = {
    getChannelStatistics: jest.fn(),
    getVideo: jest.fn(),
    searchVideos: jest.fn(),
    getTranscript: jest.fn(),
    getChannelTopVideos: jest.fn(),
    getTrendingVideos: jest.fn(),
    getVideoCategories: jest.fn(),
    batchFetchChannelStatistics: jest.fn(),
    fetchChannelRecentTopVideos: jest.fn(),
    resetApiCreditsUsed: jest.fn(),
    getApiCreditsUsed: jest.fn(),
  };
  return {
    YoutubeService: jest.fn(() => mockYoutubeService), // Mock the constructor
  };
});

// Mock utility functions
jest.mock("../../../utils/responseFormatter", () => ({
  formatSuccess: jest.fn((data) => ({
    statusCode: 200,
    body: JSON.stringify(data),
  })),
}));
jest.mock("../../../utils/errorHandler", () => ({
  formatError: jest.fn((error) => {
    // Simplified mock: in reality, this would parse ZodErrors, etc.
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    let statusCode = 500;
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ZodError"
    ) {
      statusCode = 400;
    }
    return { statusCode, body: JSON.stringify({ message }) };
  }),
}));

describe("getChannelStatisticsHandler", () => {
  // Get the mocked instance from the module mock
  let mockVideoManager: jest.Mocked<YoutubeService>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Get the instance of the mocked YoutubeService
    mockVideoManager = new YoutubeService() as jest.Mocked<YoutubeService>;
  });

  it("should return channel statistics for a single valid channel ID", async () => {
    const mockStatResult = {
      channelId: "UC123",
      title: "Test Channel",
      subscriberCount: 50,
      viewCount: 100,
      videoCount: 10,
      createdAt: "2023-01-01T00:00:00Z",
    };
    mockVideoManager.getChannelStatistics.mockResolvedValue(mockStatResult);

    const params = { channelIds: ["UC123"] };
    const result = await getChannelStatisticsHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelStatistics).toHaveBeenCalledWith("UC123");
    // The handler calls getChannelStatistics for each ID, then collects results in an array
    expect(formatSuccess).toHaveBeenCalledWith([mockStatResult]);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual([mockStatResult]);
  });

  it("should return channel statistics for multiple valid channel IDs", async () => {
    const mockStatResult1 = {
      channelId: "UC123",
      title: "Test Channel 1",
      subscriberCount: 50,
      viewCount: 100,
      videoCount: 10,
      createdAt: "2023-01-01T00:00:00Z",
    };
    const mockStatResult2 = {
      channelId: "UC456",
      title: "Test Channel 2",
      subscriberCount: 75,
      viewCount: 200,
      videoCount: 20,
      createdAt: "2023-01-01T00:00:00Z",
    };
    mockVideoManager.getChannelStatistics
      .mockResolvedValueOnce(mockStatResult1)
      .mockResolvedValueOnce(mockStatResult2);

    const params = { channelIds: ["UC123", "UC456"] };
    const result = await getChannelStatisticsHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelStatistics).toHaveBeenCalledWith("UC123");
    expect(mockVideoManager.getChannelStatistics).toHaveBeenCalledWith("UC456");
    expect(formatSuccess).toHaveBeenCalledWith([
      mockStatResult1,
      mockStatResult2,
    ]);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual([
      mockStatResult1,
      mockStatResult2,
    ]);
  });

  it("should return a 400 error if channelIds array is empty", async () => {
    const params = { channelIds: [] }; // Empty array

    const result = await getChannelStatisticsHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelStatistics).not.toHaveBeenCalled();
    // ZodError will be passed to formatError
    expect(formatError).toHaveBeenCalledWith(
      expect.objectContaining({ name: "ZodError" })
    );
    expect(result.statusCode).toBe(400);
    // The exact message depends on Zod's formatting, check for a relevant part
    expect(JSON.parse(result.body as string).message).toContain(
      "Channel IDs array must contain at least 1 element(s)"
    );
  });

  it("should return a 400 error for malformed channel IDs (e.g. empty strings in list)", async () => {
    const params = { channelIds: ["UC123", ""] }; // Contains an empty ID

    const result = await getChannelStatisticsHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelStatistics).not.toHaveBeenCalled();
    expect(formatError).toHaveBeenCalledWith(
      expect.objectContaining({ name: "ZodError" })
    );
    expect(result.statusCode).toBe(400);
    // Check that the Zod error message for the empty string is present
    expect(JSON.parse(result.body as string).message).toContain(
      "Channel ID cannot be empty"
    );
  });

  it("should return a 500 error if videoManager.getChannelStatistics throws an error", async () => {
    const errorMessage = "API Error";
    mockVideoManager.getChannelStatistics.mockRejectedValue(
      new Error(errorMessage)
    );

    const params = { channelIds: ["UC123"] };
    const result = await getChannelStatisticsHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelStatistics).toHaveBeenCalledWith("UC123");
    expect(formatError).toHaveBeenCalledWith(new Error(errorMessage));
    expect(result.statusCode).toBe(500);
    // Align with the current simple formatError mock
    expect(JSON.parse(result.body as string).message).toBe(errorMessage);
  });
});
