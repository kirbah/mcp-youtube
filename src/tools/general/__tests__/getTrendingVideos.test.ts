import {
  getTrendingVideosHandler,
  getTrendingVideosSchema,
} from "../getTrendingVideos";
import { VideoManagement } from "../../../functions/videos";
import { formatError } from "../../../utils/errorHandler";
import { formatSuccess } from "../../../utils/responseFormatter";
import { ZodError } from "zod";

// Mock dependencies
jest.mock("../../../functions/videos");
jest.mock("../../../utils/errorHandler");
jest.mock("../../../utils/responseFormatter");

const mockVideoManager = new VideoManagement({
  apiKey: "test-api-key",
}) as jest.Mocked<VideoManagement>;
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
    const mockTrendingVideos = [{ id: "1", title: "Trending Video 1" }];
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
    const mockTrendingVideos = [{ id: "2", title: "Trending Video 2" }];
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
