import { GetChannelStatisticsTool } from "../getChannelStatistics";
import type { YoutubeService } from "../../../services/youtube.service";
import { IServiceContainer } from "../../../container";

// Only mock the service
jest.mock("../../../services/youtube.service");

describe("GetChannelStatisticsTool", () => {
  let mockYoutubeService: jest.Mocked<YoutubeService>;
  let tool: GetChannelStatisticsTool;

  beforeEach(() => {
    mockYoutubeService = {
      getChannelStatistics: jest.fn(),
    } as unknown as jest.Mocked<YoutubeService>;

    const container = {
      youtubeService: mockYoutubeService,
    } as unknown as IServiceContainer;

    tool = new GetChannelStatisticsTool(container);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe("getChannelStatistics");
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
    mockYoutubeService.getChannelStatistics.mockResolvedValue(
      mockStatResult as any
    );

    const params = { channelIds: ["UC123"] };
    const result = await tool.execute(params);

    expect(mockYoutubeService.getChannelStatistics).toHaveBeenCalledWith(
      "UC123"
    );

    // Assert against the actual shape of the real formatSuccess output
    expect(result.success).toBe(true);
    expect(JSON.parse(result.content[0].text as string)).toEqual([
      mockStatResult,
    ]);
  });

  it("should return channel statistics for multiple valid channel IDs", async () => {
    const mockStatResult1 = { channelId: "UC123", title: "Channel 1" };
    const mockStatResult2 = { channelId: "UC456", title: "Channel 2" };

    // Setup sequential mock responses
    mockYoutubeService.getChannelStatistics
      .mockResolvedValueOnce(mockStatResult1 as any)
      .mockResolvedValueOnce(mockStatResult2 as any);

    const params = { channelIds: ["UC123", "UC456"] };
    const result = await tool.execute(params);

    // Verify multiple service calls
    expect(mockYoutubeService.getChannelStatistics).toHaveBeenCalledTimes(2);
    expect(mockYoutubeService.getChannelStatistics).toHaveBeenCalledWith(
      "UC123"
    );
    expect(mockYoutubeService.getChannelStatistics).toHaveBeenCalledWith(
      "UC456"
    );

    // Verify data aggregation
    const parsedContent = JSON.parse(result.content[0].text as string);
    expect(parsedContent).toHaveLength(2);
    expect(parsedContent).toEqual([mockStatResult1, mockStatResult2]);
  });

  it("should return a validation error if channelIds array is empty", async () => {
    const params = { channelIds: [] };

    const result = await tool.execute(params);

    expect(mockYoutubeService.getChannelStatistics).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    // Check for the specific Zod message defined in your schema .min(1, "...")
    expect(result.content[0].text).toContain(
      "Channel IDs array must contain at least 1 element"
    );
  });

  it("should return a validation error for malformed channel IDs (empty string)", async () => {
    const params = { channelIds: ["UC123", ""] }; // Second ID is empty

    const result = await tool.execute(params);

    expect(mockYoutubeService.getChannelStatistics).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    // This depends on your channelIdSchema implementation, usually checks for min length or regex
    expect(result.content[0].text).toMatch(/channelIds/);
  });

  it("should handle partial or total service failure", async () => {
    // Note: implementation uses Promise.all, so one failure fails the whole request
    const errorMessage = "API Error";
    mockYoutubeService.getChannelStatistics.mockRejectedValue(
      new Error(errorMessage)
    );

    const params = { channelIds: ["UC123"] };
    const result = await tool.execute(params);

    expect(mockYoutubeService.getChannelStatistics).toHaveBeenCalledWith(
      "UC123"
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(errorMessage);
  });
});
