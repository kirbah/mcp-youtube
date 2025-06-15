import { getVideoDetailsHandler } from "../getVideoDetails";
import { YoutubeService } from "../../../services/youtube.service";
import {
  calculateLikeToViewRatio,
  calculateCommentToViewRatio,
} from "../../../utils/engagementCalculator";
import { parseYouTubeNumber } from "../../../utils/numberParser";

jest.mock("../../../services/youtube.service");
jest.mock("../../../utils/engagementCalculator", () => ({
  calculateLikeToViewRatio: jest.fn(),
  calculateCommentToViewRatio: jest.fn(),
}));
jest.mock("../../../utils/numberParser");

describe("getVideoDetailsHandler", () => {
  let mockVideoManager: jest.Mocked<YoutubeService>;

  beforeEach(() => {
    mockVideoManager = new YoutubeService() as jest.Mocked<YoutubeService>;

    // Mock specific methods
    mockVideoManager.getVideo = jest.fn();

    // Reset mocks for imported functions
    (calculateLikeToViewRatio as jest.Mock).mockReset();
    (calculateCommentToViewRatio as jest.Mock).mockReset();
    (parseYouTubeNumber as jest.Mock).mockReset();

    (parseYouTubeNumber as jest.Mock).mockImplementation(
      (val) => Number(val) || 0
    );
    // Corrected parameter order to match actual function: (viewCount, likeCount)
    (calculateLikeToViewRatio as jest.Mock).mockImplementation(
      (viewCount, likeCount) =>
        Number(viewCount) > 0 ? Number(likeCount) / Number(viewCount) : 0
    );
    // Corrected parameter order to match actual function: (viewCount, commentCount)
    (calculateCommentToViewRatio as jest.Mock).mockImplementation(
      (viewCount, commentCount) =>
        Number(viewCount) > 0 ? Number(commentCount) / Number(viewCount) : 0
    );

    // Spy on console.error and mock its implementation
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error if it was spied on
    if ((console.error as any).mockRestore) {
      (console.error as any).mockRestore();
    }
  });

  const veryLongDesc = "Str".repeat(400); // 1200 chars
  const exactLengthDescription = "S".repeat(1000); // Exactly 1000 chars

  const mockVideoDetailsData: any = {
    testVideoId1: {
      id: "testVideoId1",
      snippet: {
        title: "Test Video Title 1",
        description: veryLongDesc,
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
    },
    testVideoId2Error: null,
    testVideoId3MissingFields: {
      id: "testVideoId3MissingFields",
      snippet: {
        title: "Test Video Title 3 Missing",
        channelId: "testChannelId3",
        channelTitle: "Test Channel Title 3",
        publishedAt: "2023-01-03T00:00:00Z",
      },
      statistics: {},
    },
    specificStatsVideo: {
      id: "specificStatsVideo",
      snippet: {
        title: "Stats Test",
        channelId: "chStat",
        channelTitle: "Stat Ch",
        publishedAt: "2023-01-04T00:00:00Z",
      },
      statistics: { viewCount: "5555", likeCount: "55", commentCount: "5" },
    },
    veryLongDescVideo: {
      id: "veryLongDescVideo",
      snippet: {
        title: "Long Desc Test",
        description: veryLongDesc,
        channelId: "chDesc",
        channelTitle: "Desc Ch",
        publishedAt: "2023-01-05T00:00:00Z",
      },
      statistics: { viewCount: "100" },
    },
    exactLengthVideo: {
      id: "exactLengthVideo",
      snippet: {
        title: "Exact Length Desc Test",
        description: exactLengthDescription,
        channelId: "chDesc",
        channelTitle: "Desc Ch",
        publishedAt: "2023-01-06T00:00:00Z",
      },
      statistics: { viewCount: "100" },
    },
    shortDescVideo: {
      id: "shortDescVideo",
      snippet: {
        title: "Short Desc Test",
        description: "Short and sweet.",
        channelId: "chDesc",
        channelTitle: "Desc Ch",
        publishedAt: "2023-01-07T00:00:00Z",
      },
      statistics: { viewCount: "100" },
    },
    nullDescVideo: {
      id: "nullDescVideo",
      snippet: {
        title: "Null Desc Test",
        description: null,
        channelId: "chDesc",
        channelTitle: "Desc Ch",
        publishedAt: "2023-01-08T00:00:00Z",
      },
      statistics: { viewCount: "100" },
    },
    undefinedDescVideo: {
      id: "undefinedDescVideo",
      snippet: {
        title: "Undefined Desc Test",
        description: undefined,
        channelId: "chDesc",
        channelTitle: "Desc Ch",
        publishedAt: "2023-01-09T00:00:00Z",
      },
      statistics: { viewCount: "100" },
    },
  };

  describe("getVideoDetailsHandler - Transformation Logic", () => {
    beforeEach(() => {
      mockVideoManager.getVideo.mockImplementation(
        async (params: { videoId: string }) => {
          return mockVideoDetailsData[params.videoId] || null;
        }
      );
    });

    it("should correctly transform a single video successfully", async () => {
      (calculateLikeToViewRatio as jest.Mock).mockReturnValue(0.1);
      (calculateCommentToViewRatio as jest.Mock).mockReturnValue(0.01);

      const params = { videoIds: ["testVideoId1"] };
      const result = await getVideoDetailsHandler(params, mockVideoManager);

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

    it("should handle errors gracefully and log them when a video is not found", async () => {
      // For testVideoId1 part of this test
      (calculateLikeToViewRatio as jest.Mock).mockImplementation(
        (viewCount, likeCount) =>
          Number(viewCount) > 0 ? Number(likeCount) / Number(viewCount) : 0
      );
      (calculateCommentToViewRatio as jest.Mock).mockImplementation(
        (viewCount, commentCount) =>
          Number(viewCount) > 0 ? Number(commentCount) / Number(viewCount) : 0
      );

      const params = { videoIds: ["testVideoId1", "testVideoId2Error"] };
      const result = await getVideoDetailsHandler(params, mockVideoManager);

      expect(result.success).toBe(true);
      if (!result.success || !result.content)
        throw new Error("Test failed: success true but no content");
      const returnedData = JSON.parse(result.content[0].text as string);

      const expectedData = {
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
          likeToViewRatio: 0.1, // From calculation: 100/1000
          commentToViewRatio: 0.01, // From calculation: 10/1000
          categoryId: "10",
          defaultLanguage: "en",
        },
        testVideoId2Error: null,
      };
      expect(returnedData).toEqual(expectedData);
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        "Video details not found for ID: testVideoId2Error",
        "Returned null from videoManager.getVideo"
      );
    });

    it("should handle missing optional fields gracefully", async () => {
      (calculateLikeToViewRatio as jest.Mock).mockImplementation((l, v) =>
        v > 0 ? Number(l) / Number(v) : 0
      );
      (calculateCommentToViewRatio as jest.Mock).mockImplementation((c, v) =>
        v > 0 ? Number(c) / Number(v) : 0
      );

      const params = { videoIds: ["testVideoId3MissingFields"] };
      const result = await getVideoDetailsHandler(params, mockVideoManager);

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

    it("should use parseYouTubeNumber for numeric fields and engagementCalculator for ratios", async () => {
      (parseYouTubeNumber as jest.Mock).mockImplementation(
        (val) => Number(val) * 2
      );
      (calculateLikeToViewRatio as jest.Mock).mockReturnValue(0.55);
      (calculateCommentToViewRatio as jest.Mock).mockReturnValue(0.055);

      const params = { videoIds: ["specificStatsVideo"] };
      const result = await getVideoDetailsHandler(params, mockVideoManager);
      if (!result.success || !result.content)
        throw new Error("Test failed: success true but no content");
      const returnedData = JSON.parse(result.content[0].text as string);
      const videoResult = returnedData["specificStatsVideo"];

      expect(videoResult.viewCount).toBe(11110);
      expect(videoResult.likeCount).toBe(110);
      expect(videoResult.commentCount).toBe(10);
      expect(videoResult.likeToViewRatio).toBe(0.55);
      expect(videoResult.commentToViewRatio).toBe(0.055);

      expect(parseYouTubeNumber).toHaveBeenCalledWith("5555");
      expect(parseYouTubeNumber).toHaveBeenCalledWith("55");
      expect(parseYouTubeNumber).toHaveBeenCalledWith("5");
      expect(calculateLikeToViewRatio).toHaveBeenCalledWith(11110, 110);
      expect(calculateCommentToViewRatio).toHaveBeenCalledWith(11110, 10);
    });

    it("should correctly truncate description longer than 500 characters when using LONG", async () => {
      (calculateLikeToViewRatio as jest.Mock).mockReturnValue(0);
      (calculateCommentToViewRatio as jest.Mock).mockReturnValue(0);
      const params = {
        videoIds: ["veryLongDescVideo"],
        descriptionDetail: "LONG" as const,
      };
      const result = await getVideoDetailsHandler(params, mockVideoManager);
      if (!result.success || !result.content)
        throw new Error("Test failed: success true but no content");
      const returnedData = JSON.parse(result.content[0].text as string);
      const videoResult = returnedData["veryLongDescVideo"];

      expect(videoResult.description.length).toBe(500 + 3);
      expect(videoResult.description.endsWith("...")).toBe(true);
      expect(videoResult.description).toBe(
        veryLongDesc.substring(0, 500) + "..."
      );
    });

    it("should not truncate description if it is within LONG limit when using LONG", async () => {
      (calculateLikeToViewRatio as jest.Mock).mockReturnValue(0);
      (calculateCommentToViewRatio as jest.Mock).mockReturnValue(0);
      let params = {
        videoIds: ["shortDescVideo"],
        descriptionDetail: "LONG" as const,
      };
      let result = await getVideoDetailsHandler(params, mockVideoManager);
      if (!result.success || !result.content)
        throw new Error("Test failed: success true but no content");
      let returnedData = JSON.parse(result.content[0].text as string);
      let videoResult = returnedData["shortDescVideo"];
      expect(videoResult.description).toBe("Short and sweet.");
    });

    it("should return undefined description if original description is null or undefined when using LONG", async () => {
      (calculateLikeToViewRatio as jest.Mock).mockReturnValue(0);
      (calculateCommentToViewRatio as jest.Mock).mockReturnValue(0);
      let params = {
        videoIds: ["nullDescVideo"],
        descriptionDetail: "LONG" as const,
      };
      let result = await getVideoDetailsHandler(params, mockVideoManager);
      if (!result.success || !result.content)
        throw new Error("Test failed: success true but no content");
      let returnedData = JSON.parse(result.content[0].text as string);
      let videoResult = returnedData["nullDescVideo"];
      expect(videoResult.description).toBeUndefined();

      params = {
        videoIds: ["undefinedDescVideo"],
        descriptionDetail: "LONG" as const,
      };
      result = await getVideoDetailsHandler(params, mockVideoManager);
      if (!result.success || !result.content)
        throw new Error("Test failed: success true but no content");
      returnedData = JSON.parse(result.content[0].text as string);
      videoResult = returnedData["undefinedDescVideo"];
      expect(videoResult.description).toBeUndefined();
    });
  });
});
