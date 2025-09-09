import { YoutubeService } from "../../../services/youtube.service.js";
import {
  getVideoCommentsHandler,
  getVideoCommentsSchema,
} from "../getVideoComments.js";
import { formatSuccess } from "../../../utils/responseFormatter.js";
import { formatError } from "../../../utils/errorHandler.js";
import { z } from "zod";

// Mock the YoutubeService
const mockYoutubeService = {
  getVideoComments: jest.fn(),
} as unknown as YoutubeService;

// Mock the formatSuccess and formatError functions
jest.mock("../../../utils/responseFormatter.js", () => ({
  formatSuccess: jest.fn((data) => ({
    success: true,
    content: [{ type: "text", text: JSON.stringify(data) }],
    output: { data },
  })),
}));

jest.mock("../../../utils/errorHandler.js", () => ({
  formatError: jest.fn((error) => ({
    success: false,
    content: [{ type: "text", text: `Error: ${error.message}` }],
    output: { message: error.message },
  })),
}));

describe("getVideoCommentsHandler", () => {
  let parseSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    parseSpy = jest.spyOn(getVideoCommentsSchema, "parse");
  });

  afterEach(() => {
    parseSpy.mockRestore();
  });

  it("should return a successful response with formatted comments", async () => {
    const mockComments = [
      {
        commentId: "comment1",
        author: "Author1",
        text: "This is comment 1",
        publishedAt: "2023-01-01T00:00:00Z",
        likeCount: 10,
        replies: [],
      },
    ];
    (mockYoutubeService.getVideoComments as jest.Mock).mockResolvedValue(
      mockComments
    );

    const params = {
      videoId: "testVideoId",
      maxResults: 1,
      order: "relevance" as const,
      maxReplies: 0,
      commentDetail: "FULL" as const,
    };

    parseSpy.mockReturnValue(params); // Mock successful parsing

    const result = await getVideoCommentsHandler(params, mockYoutubeService);

    expect(parseSpy).toHaveBeenCalledWith(params);
    expect(mockYoutubeService.getVideoComments).toHaveBeenCalledWith(params);
    expect(formatSuccess).toHaveBeenCalledWith(mockComments);
    expect(result.success).toBe(true);
    expect((result.output as { data: any }).data).toEqual(mockComments);
  });

  it("should return an error response if youtubeService.getVideoComments fails", async () => {
    const mockError = new Error("Failed to fetch comments");
    (mockYoutubeService.getVideoComments as jest.Mock).mockRejectedValue(
      mockError
    );

    const params = {
      videoId: "testVideoId",
      maxResults: 1,
      order: "relevance" as const,
      maxReplies: 0,
      commentDetail: "FULL" as const,
    };

    parseSpy.mockReturnValue(params); // Mock successful parsing

    const result = await getVideoCommentsHandler(params, mockYoutubeService);

    expect(parseSpy).toHaveBeenCalledWith(params);
    expect(mockYoutubeService.getVideoComments).toHaveBeenCalledWith(params);
    expect(formatError).toHaveBeenCalledWith(mockError);
    expect(result.success).toBe(false);
    expect((result.output as { message: string }).message).toContain(
      "Failed to fetch comments"
    );
  });

  it("should return an error response if parameter validation fails", async () => {
    const mockInvalidParams = {
      videoId: "", // Invalid videoId
      maxResults: 1,
      order: "relevance" as const,
      maxReplies: 0,
      commentDetail: "FULL" as const,
    };

    // Mock the parse method to throw an error for invalid params
    parseSpy.mockImplementation(() => {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.too_small,
          minimum: 1,
          type: "string",
          inclusive: true,
          exact: false,
          message: "String must contain at least 1 character(s)",
          path: ["videoId"],
        },
      ]);
    });

    const result = await getVideoCommentsHandler(
      mockInvalidParams as any,
      mockYoutubeService
    );

    expect(parseSpy).toHaveBeenCalledWith(mockInvalidParams);
    expect(mockYoutubeService.getVideoComments).not.toHaveBeenCalled(); // Should not call service if validation fails
    expect(formatError).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect((result.output as { message: string }).message).toContain(
      "String must contain at least 1 character(s)"
    );
  });
});
