import { GetVideoDetailsTool } from "../getVideoDetails";
import type { YoutubeService } from "../../../services/youtube.service";
import { IServiceContainer } from "../../../container";

jest.mock("../../../services/youtube.service");

describe("GetVideoDetailsTool", () => {
  let mockYoutubeService: jest.Mocked<YoutubeService>;
  let tool: GetVideoDetailsTool;

  beforeEach(() => {
    mockYoutubeService = {
      getVideo: jest.fn(),
    } as unknown as jest.Mocked<YoutubeService>;

    const container = {
      youtubeService: mockYoutubeService,
    } as unknown as IServiceContainer;

    tool = new GetVideoDetailsTool(container);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe("getVideoDetails");
  });

  it("should correctly transform a single video successfully", async () => {
    const mockVideoDetails = {
      id: "testVideoId1",
      snippet: {
        title: "Test Video Title 1",
        description: "A description",
        channelId: "testChannelId1",
        channelTitle: "Test Channel Title 1",
        publishedAt: "2023-01-01T00:00:00Z",
        tags: ["tag1", "tag2"],
        categoryId: "10",
        defaultLanguage: "en",
      },
      contentDetails: {
        duration: "PT1M30S",
      },
      statistics: {
        viewCount: "1000",
        likeCount: "100",
        commentCount: "10",
      },
    };
    mockYoutubeService.getVideo.mockResolvedValue(mockVideoDetails as any);

    const params = { videoIds: ["testVideoId1"] };
    const result = await tool.execute(params);

    expect(result.success).toBe(true);
    if (!result.success || !result.content)
      throw new Error("Test failed: success true but no content");
    const returnedData = JSON.parse(result.content[0].text as string);

    const expectedTransformedVideo = {
      testVideoId1: {
        id: "testVideoId1",
        title: "Test Video Title 1",
        channelId: "testChannelId1",
        channelTitle: "Test Channel Title 1",
        publishedAt: "2023-01-01T00:00:00Z",
        duration: "PT1M30S",
        viewCount: 1000,
        likeCount: 100,
        commentCount: 10,
        likeToViewRatio: 0.1,
        commentToViewRatio: 0.01,
        categoryId: "10",
        defaultLanguage: "en",
      },
    };
    expect(returnedData).toEqual(expectedTransformedVideo);
  });

  it("should return an error if youtubeService.getVideo throws an error", async () => {
    mockYoutubeService.getVideo.mockRejectedValue(
      new Error("Video not found.")
    );

    const params = { videoIds: ["testVideoId2Error"] };
    const result = await tool.execute(params);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Video not found.");
  });

  it("should handle missing optional fields gracefully", async () => {
    const mockVideoDetails = {
      id: "testVideoId3MissingFields",
      snippet: {
        title: "Test Video Title 3 Missing",
        channelId: "testChannelId3",
        channelTitle: "Test Channel Title 3",
        publishedAt: "2023-01-03T00:00:00Z",
      },
      statistics: {},
    };
    mockYoutubeService.getVideo.mockResolvedValue(mockVideoDetails as any);

    const params = { videoIds: ["testVideoId3MissingFields"] };
    const result = await tool.execute(params);

    expect(result.success).toBe(true);
    if (!result.success || !result.content)
      throw new Error("Test failed: success true but no content");
    const returnedData = JSON.parse(result.content[0].text as string);

    const expectedTransformedVideo = {
      testVideoId3MissingFields: {
        id: "testVideoId3MissingFields",
        title: "Test Video Title 3 Missing",
        channelId: "testChannelId3",
        channelTitle: "Test Channel Title 3",
        publishedAt: "2023-01-03T00:00:00Z",
        duration: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        likeToViewRatio: 0,
        commentToViewRatio: 0,
        categoryId: null,
        defaultLanguage: null,
      },
    };
    expect(returnedData).toEqual(expectedTransformedVideo);
  });
});
