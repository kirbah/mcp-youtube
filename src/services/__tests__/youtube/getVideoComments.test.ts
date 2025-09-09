import { YoutubeService } from "../../youtube.service.js";
import { CacheService } from "../../cache.service.js";
import { google, youtube_v3 } from "googleapis";
import { CACHE_COLLECTIONS, CACHE_TTLS } from "../../../config/cache.config.js";

// Mock the google.youtube object
const mockYoutube = {
  commentThreads: {
    list: jest.fn(),
  },
  comments: {
    list: jest.fn(),
  },
} as unknown as jest.Mocked<youtube_v3.Youtube>;

jest.mock("googleapis", () => ({
  google: {
    youtube: jest.fn(() => mockYoutube),
  },
}));

describe("YoutubeService - getVideoComments", () => {
  let youtubeService: YoutubeService;
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = {
      getOrSet: jest.fn((key, operation, ttl, collection, options, exclude) =>
        operation()
      ),
      createOperationKey: jest.fn((name, options) =>
        JSON.stringify({ name, options })
      ),
    } as unknown as CacheService;
    youtubeService = new YoutubeService(cacheService);
    youtubeService.resetApiCreditsUsed(); // Reset credits for each test
    jest.clearAllMocks();
  });

  it("should retrieve top-level comments and transform data correctly", async () => {
    const mockCommentThreadsResponse = {
      data: {
        items: [
          {
            id: "comment1",
            snippet: {
              topLevelComment: {
                snippet: {
                  authorDisplayName: "Author1",
                  textDisplay: "This is comment 1",
                  publishedAt: "2023-01-01T00:00:00Z",
                  likeCount: 10,
                },
              },
            },
          },
          {
            id: "comment2",
            snippet: {
              topLevelComment: {
                snippet: {
                  authorDisplayName: "Author2",
                  textDisplay: "This is comment 2",
                  publishedAt: "2023-01-02T00:00:00Z",
                  likeCount: 5,
                },
              },
            },
          },
        ],
      },
    };

    (mockYoutube.commentThreads.list as jest.Mock).mockResolvedValue(
      mockCommentThreadsResponse
    );
    (mockYoutube.comments.list as jest.Mock).mockResolvedValue({
      data: { items: [] },
    }); // No replies for this test

    const options = {
      videoId: "testVideoId",
      maxResults: 2,
      order: "relevance" as const,
      maxReplies: 0,
      commentDetail: "FULL" as const,
    };

    const result = await youtubeService.getVideoComments(options);

    expect(mockYoutube.commentThreads.list).toHaveBeenCalledWith({
      part: ["snippet"],
      videoId: "testVideoId",
      maxResults: 2,
      order: "relevance",
    });
    expect(mockYoutube.comments.list).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        commentId: "comment1",
        author: "Author1",
        text: "This is comment 1",
        publishedAt: "2023-01-01T00:00:00Z",
        likeCount: 10,
        replies: [],
      },
      {
        commentId: "comment2",
        author: "Author2",
        text: "This is comment 2",
        publishedAt: "2023-01-02T00:00:00Z",
        likeCount: 5,
        replies: [],
      },
    ]);
    expect(youtubeService.getApiCreditsUsed()).toBe(1); // 1 for commentThreads.list
  });

  it("should fetch replies in parallel when maxReplies > 0", async () => {
    const mockCommentThreadsResponse = {
      data: {
        items: [
          {
            id: "comment1",
            snippet: {
              topLevelComment: {
                snippet: {
                  authorDisplayName: "Author1",
                  textDisplay: "Top comment 1",
                  publishedAt: "2023-01-01T00:00:00Z",
                  likeCount: 10,
                },
              },
            },
          },
          {
            id: "comment2",
            snippet: {
              topLevelComment: {
                snippet: {
                  authorDisplayName: "Author2",
                  textDisplay: "Top comment 2",
                  publishedAt: "2023-01-02T00:00:00Z",
                  likeCount: 5,
                },
              },
            },
          },
        ],
      },
    };

    const mockRepliesResponse1 = {
      data: {
        items: [
          {
            id: "reply1_1",
            snippet: {
              authorDisplayName: "ReplyAuthor1",
              textDisplay: "Reply to comment 1",
              publishedAt: "2023-01-01T00:01:00Z",
              likeCount: 2,
            },
          },
        ],
      },
    };

    const mockRepliesResponse2 = {
      data: {
        items: [
          {
            id: "reply2_1",
            snippet: {
              authorDisplayName: "ReplyAuthor2",
              textDisplay: "Reply to comment 2",
              publishedAt: "2023-01-02T00:01:00Z",
              likeCount: 1,
            },
          },
        ],
      },
    };

    (mockYoutube.commentThreads.list as jest.Mock).mockResolvedValue(
      mockCommentThreadsResponse
    );
    (mockYoutube.comments.list as jest.Mock)
      .mockResolvedValueOnce(mockRepliesResponse1)
      .mockResolvedValueOnce(mockRepliesResponse2);

    const options = {
      videoId: "testVideoId",
      maxResults: 2,
      order: "relevance" as const,
      maxReplies: 1,
      commentDetail: "FULL" as const,
    };

    const result = await youtubeService.getVideoComments(options);

    expect(mockYoutube.commentThreads.list).toHaveBeenCalledTimes(1);
    expect(mockYoutube.comments.list).toHaveBeenCalledTimes(2);
    expect(mockYoutube.comments.list).toHaveBeenCalledWith({
      part: ["snippet"],
      parentId: "comment1",
      maxResults: 1,
    });
    expect(mockYoutube.comments.list).toHaveBeenCalledWith({
      part: ["snippet"],
      parentId: "comment2",
      maxResults: 1,
    });
    expect(result).toEqual([
      {
        commentId: "comment1",
        author: "Author1",
        text: "Top comment 1",
        publishedAt: "2023-01-01T00:00:00Z",
        likeCount: 10,
        replies: [
          {
            replyId: "reply1_1",
            author: "ReplyAuthor1",
            text: "Reply to comment 1",
            publishedAt: "2023-01-01T00:01:00Z",
            likeCount: 2,
          },
        ],
      },
      {
        commentId: "comment2",
        author: "Author2",
        text: "Top comment 2",
        publishedAt: "2023-01-02T00:00:00Z",
        likeCount: 5,
        replies: [
          {
            replyId: "reply2_1",
            author: "ReplyAuthor2",
            text: "Reply to comment 2",
            publishedAt: "2023-01-02T00:01:00Z",
            likeCount: 1,
          },
        ],
      },
    ]);
    expect(youtubeService.getApiCreditsUsed()).toBe(1 + 2); // 1 for commentThreads.list, 2 for comments.list
  });

  it("should handle 'comments disabled' error by returning an empty array", async () => {
    const mockError = {
      response: {
        status: 403,
        data: {
          error: {
            errors: [{ reason: "commentsDisabled" }],
          },
        },
      },
    };

    (mockYoutube.commentThreads.list as jest.Mock).mockRejectedValue(mockError);

    const options = {
      videoId: "testVideoId",
      maxResults: 2,
      order: "relevance" as const,
      maxReplies: 0,
      commentDetail: "FULL" as const,
    };

    const result = await youtubeService.getVideoComments(options);

    expect(result).toEqual([]);
    expect(mockYoutube.commentThreads.list).toHaveBeenCalledTimes(1);
    expect(youtubeService.getApiCreditsUsed()).toBe(1); // Cost is still tracked even on error
  });

  it("should truncate comment text if commentDetail is 'SNIPPET'", async () => {
    const longText = "a".repeat(250);
    const mockCommentThreadsResponse = {
      data: {
        items: [
          {
            id: "comment1",
            snippet: {
              topLevelComment: {
                snippet: {
                  authorDisplayName: "Author1",
                  textDisplay: longText,
                  publishedAt: "2023-01-01T00:00:00Z",
                  likeCount: 10,
                },
              },
            },
          },
        ],
      },
    };

    const mockRepliesResponse = {
      data: {
        items: [
          {
            id: "reply1_1",
            snippet: {
              authorDisplayName: "ReplyAuthor1",
              textDisplay: longText,
              publishedAt: "2023-01-01T00:01:00Z",
              likeCount: 2,
            },
          },
        ],
      },
    };

    (mockYoutube.commentThreads.list as jest.Mock).mockResolvedValue(
      mockCommentThreadsResponse
    );
    (mockYoutube.comments.list as jest.Mock).mockResolvedValue(
      mockRepliesResponse
    );

    const options = {
      videoId: "testVideoId",
      maxResults: 1,
      order: "relevance" as const,
      maxReplies: 1,
      commentDetail: "SNIPPET" as const,
    };

    const result = await youtubeService.getVideoComments(options);

    expect(result[0].text).toHaveLength(200);
    expect(result[0].replies[0].text).toHaveLength(200);
    expect(result[0].text).toBe(longText.substring(0, 200));
    expect(result[0].replies[0].text).toBe(longText.substring(0, 200));
  });

  it("should use cacheService.getOrSet", async () => {
    const mockCommentThreadsResponse = {
      data: {
        items: [
          {
            id: "comment1",
            snippet: {
              topLevelComment: {
                snippet: {
                  authorDisplayName: "Author1",
                  textDisplay: "This is comment 1",
                  publishedAt: "2023-01-01T00:00:00Z",
                  likeCount: 10,
                },
              },
            },
          },
        ],
      },
    };

    (mockYoutube.commentThreads.list as jest.Mock).mockResolvedValue(
      mockCommentThreadsResponse
    );
    (mockYoutube.comments.list as jest.Mock).mockResolvedValue({
      data: { items: [] },
    });

    const options = {
      videoId: "testVideoId",
      maxResults: 2,
      order: "relevance" as const,
      maxReplies: 0,
      commentDetail: "FULL" as const,
    };

    await youtubeService.getVideoComments(options);

    expect(cacheService.getOrSet).toHaveBeenCalledWith(
      JSON.stringify({ name: "getVideoComments", options }),
      expect.any(Function),
      CACHE_TTLS.DYNAMIC,
      CACHE_COLLECTIONS.VIDEO_COMMENTS,
      options
    );
  });

  it("should re-throw other errors", async () => {
    const mockError = new Error("Network error");
    (mockYoutube.commentThreads.list as jest.Mock).mockRejectedValue(mockError);

    const options = {
      videoId: "testVideoId",
      maxResults: 2,
      order: "relevance" as const,
      maxReplies: 0,
      commentDetail: "FULL" as const,
    };

    await expect(youtubeService.getVideoComments(options)).rejects.toThrow(
      `YouTube API call for getVideoComments failed for videoId: ${options.videoId}`
    );
  });
});
