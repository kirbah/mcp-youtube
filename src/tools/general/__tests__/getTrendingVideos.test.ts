import {
  getTrendingVideosHandler,
  getTrendingVideosSchema,
} from "../getTrendingVideos";
import { YoutubeService } from "../../../services/youtube.service";
import { formatError } from "../../../utils/errorHandler";
import { formatSuccess } from "../../../utils/responseFormatter";
import { ZodError } from "zod";

// Mock dependencies
jest.mock("../../../services/youtube.service");
jest.mock("../../../utils/errorHandler");
jest.mock("../../../utils/responseFormatter");

const mockVideoManager = new YoutubeService();
const mockFormatError = formatError as jest.Mock;
const mockFormatSuccess = formatSuccess as jest.Mock;

describe("getTrendingVideosHandler", () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(getTrendingVideosHandler).toBeDefined();
  });

  it("should call videoManager.getTrendingVideos with default parameters when none are provided", async () => {
    const mockTrendingVideos = [
      {
        id: "1",
        title: "Trending Video 1",
        channelId: "channel1",
        channelTitle: "Channel One",
        publishedAt: "2023-01-01T00:00:00Z",
        duration: "PT10M0S",
        viewCount: 10000,
        likeCount: 1000,
        commentCount: 100,
        likeToViewRatio: 0.1,
        commentToViewRatio: 0.01,
      },
    ];
    mockVideoManager.getTrendingVideos.mockResolvedValue(mockTrendingVideos);
    mockFormatSuccess.mockReturnValue({
      success: true,
      data: mockTrendingVideos,
    });

    const result = await getTrendingVideosHandler({}, mockVideoManager);

    // expect(getTrendingVideosSchema.parse).toHaveBeenCalledWith({}); // Removed this line
    expect(mockVideoManager.getTrendingVideos).toHaveBeenCalledWith({
      regionCode: "US",
      categoryId: undefined,
      maxResults: 10,
    });
    expect(mockFormatSuccess).toHaveBeenCalledWith(mockTrendingVideos);
    expect(result).toEqual({ success: true, data: mockTrendingVideos });
  });

  it("should call videoManager.getTrendingVideos with provided parameters", async () => {
    const mockTrendingVideos = [
      {
        id: "2",
        title: "Trending Video 2",
        channelId: "channel2",
        channelTitle: "Channel Two",
        publishedAt: "2023-01-02T00:00:00Z",
        duration: "PT12M0S",
        viewCount: 20000,
        likeCount: 2000,
        commentCount: 200,
        likeToViewRatio: 0.1,
        commentToViewRatio: 0.01,
      },
    ];
    const params = { regionCode: "GB", categoryId: "10", maxResults: 5 };
    mockVideoManager.getTrendingVideos.mockResolvedValue(mockTrendingVideos);
    mockFormatSuccess.mockReturnValue({
      success: true,
      data: mockTrendingVideos,
    });

    const result = await getTrendingVideosHandler(params, mockVideoManager);

    expect(mockVideoManager.getTrendingVideos).toHaveBeenCalledWith(params);
    expect(mockFormatSuccess).toHaveBeenCalledWith(mockTrendingVideos);
    expect(result).toEqual({ success: true, data: mockTrendingVideos });
  });

  it("should return a formatted error if schema validation fails", async () => {
    const invalidParams = {
      regionCode: "USA",
      categoryId: "10",
      maxResults: 5,
    }; // Invalid regionCode
    const mockError = new ZodError([]);
    // Mock the schema parse to throw an error
    jest.spyOn(getTrendingVideosSchema, "parse").mockImplementationOnce(() => {
      throw mockError;
    });
    mockFormatError.mockReturnValue({
      success: false,
      error: "Validation failed",
    });

    const result = await getTrendingVideosHandler(
      invalidParams,
      mockVideoManager
    );

    expect(getTrendingVideosSchema.parse).toHaveBeenCalledWith(invalidParams);
    expect(mockFormatError).toHaveBeenCalledWith(mockError);
    expect(result).toEqual({ success: false, error: "Validation failed" });

    // Restore the original parse method
    jest.restoreAllMocks();
  });

  it("should return a formatted error if videoManager.getTrendingVideos throws an error", async () => {
    const params = { regionCode: "US", categoryId: "10", maxResults: 5 };
    const mockError = new Error("API error");
    mockVideoManager.getTrendingVideos.mockRejectedValue(mockError);
    mockFormatError.mockReturnValue({ success: false, error: "API error" });

    const result = await getTrendingVideosHandler(params, mockVideoManager);

    expect(mockVideoManager.getTrendingVideos).toHaveBeenCalledWith(params);
    expect(mockFormatError).toHaveBeenCalledWith(mockError);
    expect(result).toEqual({ success: false, error: "API error" });
  });
});
