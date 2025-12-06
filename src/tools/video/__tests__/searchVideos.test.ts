import { SearchVideosTool } from "../searchVideos";
import type { YoutubeService } from "../../../services/youtube.service";
import { IServiceContainer } from "../../../container";

jest.mock("../../../services/youtube.service");

describe("SearchVideosTool", () => {
  let mockYoutubeService: jest.Mocked<YoutubeService>;
  let tool: SearchVideosTool;

  beforeEach(() => {
    mockYoutubeService = {
      searchVideos: jest.fn(),
    } as unknown as jest.Mocked<YoutubeService>;

    const container = {
      youtubeService: mockYoutubeService,
    } as unknown as IServiceContainer;

    tool = new SearchVideosTool(container);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe("searchVideos");
  });

  it("should call youtubeService.searchVideos with correct parameters", async () => {
    const mockSearchResults = [
      {
        id: { videoId: "1" },
        snippet: {
          title: "Video 1",
          description: "Description 1",
          channelId: "channel1",
          channelTitle: "Channel 1",
          publishedAt: "2023-01-01T00:00:00Z",
        },
      },
    ];
    mockYoutubeService.searchVideos.mockResolvedValue(mockSearchResults as any);

    const params = {
      query: "test query",
      maxResults: 10,
      regionCode: "US",
    };
    await tool.execute(params);

    expect(mockYoutubeService.searchVideos).toHaveBeenCalledWith(params);
  });

  it("should return a successful result with the correct content", async () => {
    const mockSearchResults = [
      {
        id: { videoId: "1" },
        snippet: {
          title: "Video 1",
          description: "Description 1",
          channelId: "channel1",
          channelTitle: "Channel 1",
          publishedAt: "2023-01-01T00:00:00Z",
        },
      },
    ];
    mockYoutubeService.searchVideos.mockResolvedValue(mockSearchResults as any);

    const params = { query: "test query" };
    const result = await tool.execute(params);

    expect(result.success).toBe(true);
    if (!result.success || !result.content)
      throw new Error("Test failed: success true but no content");
    const returnedData = JSON.parse(result.content[0].text as string);
    const expectedData = [
      {
        videoId: "1",
        title: "Video 1",
        descriptionSnippet: "Description 1",
        channelId: "channel1",
        channelTitle: "Channel 1",
        publishedAt: "2023-01-01T00:00:00Z",
      },
    ];
    expect(returnedData).toEqual(expectedData);
  });

  it("should return an error if youtubeService.searchVideos throws an error", async () => {
    mockYoutubeService.searchVideos.mockRejectedValue(
      new Error("API limit exceeded")
    );

    const params = { query: "test query" };
    const result = await tool.execute(params);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("API limit exceeded");
  });

  it("should return a Zod validation error for invalid parameters", async () => {
    const invalidParams = { query: "" }; // query is required
    const result = await tool.execute(invalidParams);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Query cannot be empty");
  });
});
