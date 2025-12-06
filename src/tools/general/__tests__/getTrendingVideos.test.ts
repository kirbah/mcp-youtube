import {
  GetTrendingVideosTool,
  getTrendingVideosSchema,
} from "../getTrendingVideos";
import type { YoutubeService } from "../../../services/youtube.service";
import { IServiceContainer } from "../../../container";
// USE REAL FORMATTER
import { formatSuccess } from "../../../utils/responseFormatter";

// Only mock the heavy service, not the utils
jest.mock("../../../services/youtube.service");

describe("GetTrendingVideosTool", () => {
  let mockYoutubeService: jest.Mocked<YoutubeService>;
  let tool: GetTrendingVideosTool;

  beforeEach(() => {
    // Create a type-safe mock
    mockYoutubeService = {
      getTrendingVideos: jest.fn(),
    } as unknown as jest.Mocked<YoutubeService>; // Ideally use jest-mock-extended here

    const container = {
      youtubeService: mockYoutubeService,
    } as unknown as IServiceContainer;

    tool = new GetTrendingVideosTool(container);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe("getTrendingVideos");
  });

  it("should validate defaults and call service", async () => {
    const mockTrendingVideos = [{ id: "1", title: "Video 1" }]; // Simplified mock
    mockYoutubeService.getTrendingVideos.mockResolvedValue(
      mockTrendingVideos as any
    );

    // Act: Call with empty object
    const result = await tool.execute({});

    // Assert: Zod default applied (US, 10)
    expect(mockYoutubeService.getTrendingVideos).toHaveBeenCalledWith({
      regionCode: "US",
      maxResults: 10,
    });

    // Assert: Real formatter output structure
    expect(result).toEqual({
      success: true,
      content: [
        { type: "text", text: JSON.stringify(mockTrendingVideos, null, 2) },
      ],
    });
  });

  it("should pass provided parameters correctly", async () => {
    const mockTrendingVideos = [{ id: "2", title: "Video 2" }];
    mockYoutubeService.getTrendingVideos.mockResolvedValue(
      mockTrendingVideos as any
    );

    const params = { regionCode: "GB", categoryId: "10", maxResults: 5 };

    // We explicitly cast params to satisfy TS if needed, or rely on internal Zod inference
    await tool.execute(params);

    expect(mockYoutubeService.getTrendingVideos).toHaveBeenCalledWith(params);
  });

  it("should return a formatted error if schema validation fails", async () => {
    const invalidParams = {
      regionCode: "INVALID_COUNTRY", // Too long
      maxResults: 1000, // Too high
    };

    const result = await tool.execute(invalidParams);

    expect(result.isError).toBe(true);
    // Verify BaseTool captured the Zod error message specifically
    expect(result.content[0].text).toContain("regionCode");
  });

  it("should handle service errors gracefully", async () => {
    const mockError = new Error("YouTube API Quota Exceeded");
    mockYoutubeService.getTrendingVideos.mockRejectedValue(mockError);

    const result = await tool.execute({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("YouTube API Quota Exceeded");
  });
});
