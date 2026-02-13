import { GetChannelTopVideosTool } from "../getChannelTopVideos";
import type { YoutubeService } from "../../../services/youtube.service";
import { IServiceContainer } from "../../../container";

// Only mock the service
jest.mock("../../../services/youtube.service");

describe("GetChannelTopVideosTool", () => {
  let mockYoutubeService: jest.Mocked<YoutubeService>;
  let tool: GetChannelTopVideosTool;

  beforeEach(() => {
    mockYoutubeService = {
      getChannelTopVideos: jest.fn(),
    } as unknown as jest.Mocked<YoutubeService>;

    const container = {
      youtubeService: mockYoutubeService,
    } as unknown as IServiceContainer;

    tool = new GetChannelTopVideosTool(container);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe("getChannelTopVideos");
  });

  it("should return top videos using default optional parameters", async () => {
    const mockTopVideosResult = [
      { id: "vid1", title: "Video 1" },
      { id: "vid2", title: "Video 2" },
    ];
    mockYoutubeService.getChannelTopVideos.mockResolvedValue(
      mockTopVideosResult as any
    );

    // Only providing required channelId
    const params = { channelId: "UC123" };
    const result = await tool.execute(params);

    // Assert defaults were applied: maxResults=10, includeTags=false, descriptionDetail=NONE
    expect(mockYoutubeService.getChannelTopVideos).toHaveBeenCalledWith({
      channelId: "UC123",
      maxResults: 10,
      includeTags: false,
      descriptionDetail: "NONE",
    });

    expect(result.success).toBe(true);
    expect(JSON.parse(result.content[0].text as string)).toEqual(
      mockTopVideosResult
    );
  });

  it("should correctly pass all provided optional parameters", async () => {
    const mockTopVideosResult = [{ id: "vid1", title: "Detailed Video" }];
    mockYoutubeService.getChannelTopVideos.mockResolvedValue(
      mockTopVideosResult as any
    );

    const params = {
      channelId: "UC123",
      maxResults: 5,
      includeTags: true,
      descriptionDetail: "SNIPPET" as const, // "as const" ensures it matches the Zod Enum type
    };

    await tool.execute(params);

    expect(mockYoutubeService.getChannelTopVideos).toHaveBeenCalledWith({
      channelId: "UC123",
      maxResults: 5,
      includeTags: true,
      descriptionDetail: "SNIPPET",
    });
  });

  it("should return a validation error for an invalid channelId", async () => {
    const params = { channelId: "" }; // Empty string
    const result = await tool.execute(params);

    expect(mockYoutubeService.getChannelTopVideos).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    // Expect error to specifically mention the field
    expect(result.content[0].text).toMatch(/channelId/);
  });

  it("should return a validation error if maxResults is less than 1", async () => {
    const params = { channelId: "UC123", maxResults: 0 };
    const result = await tool.execute(params);

    expect(mockYoutubeService.getChannelTopVideos).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("maxResults");
  });

  it("should return a validation error if maxResults is greater than 500", async () => {
    const params = { channelId: "UC123", maxResults: 501 };
    const result = await tool.execute(params);

    expect(mockYoutubeService.getChannelTopVideos).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("maxResults");
  });

  it("should return a validation error if descriptionDetail is invalid", async () => {
    const params = {
      channelId: "UC123",
      descriptionDetail: "INVALID_OPTION",
    };
    // @ts-ignore - deliberately passing invalid enum for test
    const result = await tool.execute(params);

    expect(mockYoutubeService.getChannelTopVideos).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid option: expected one of");
  });

  it("should handle service errors gracefully", async () => {
    const errorMessage = "API Error";
    mockYoutubeService.getChannelTopVideos.mockRejectedValue(
      new Error(errorMessage)
    );

    const params = { channelId: "UC123" };
    const result = await tool.execute(params);

    expect(mockYoutubeService.getChannelTopVideos).toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(`Error: ${errorMessage}`);
  });
});
