import { searchVideosHandler } from "../searchVideos";
import * as searchVideosModule from "../searchVideos"; // Import the whole module for spy
import { VideoManagement } from "../../../functions/videos";
import { formatError } from "../../../utils/errorHandler";
import { formatSuccess } from "../../../utils/responseFormatter";
import type { youtube_v3 } from "googleapis";
import type { LeanVideoSearchResult } from "../../../types/youtube";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types";

// NOTE: jest.mock for '../searchVideos' related to schema is removed to use jest.spyOn

jest.mock("../../../functions/videos"); // Mocks VideoManagement class
jest.mock("../../../utils/errorHandler");
jest.mock("../../../utils/responseFormatter");

describe("searchVideosHandler", () => {
  let mockVideoManager: jest.Mocked<VideoManagement>;
  let parseSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVideoManager = new VideoManagement(
      null as any
    ) as jest.Mocked<VideoManagement>;
    mockVideoManager.searchVideos = jest.fn();

    // Spy on the 'parse' method of the actual searchVideosSchema from the imported module
    parseSpy = jest.spyOn(searchVideosModule.searchVideosSchema, "parse");
  });

  afterEach(() => {
    // Restore the original implementation after each test
    parseSpy.mockRestore();
  });

  it("should call searchVideosSchema.parse with input parameters", async () => {
    const mockParams = { query: "test query" };
    parseSpy.mockReturnValueOnce({ query: "test query", maxResults: 10 }); // Use spy
    (mockVideoManager.searchVideos as jest.Mock).mockResolvedValueOnce([]);
    (formatSuccess as jest.Mock).mockReturnValueOnce({} as CallToolResult);

    await searchVideosHandler(mockParams, mockVideoManager);

    expect(parseSpy).toHaveBeenCalledWith(mockParams); // Check spy
  });

  it("should call formatError when searchVideosSchema.parse throws a Zod error", async () => {
    const mockParams = { query: "invalid query" };
    const zodError = new Error("Zod validation failed");
    (zodError as any).issues = [{ message: "Invalid input" }];
    parseSpy.mockImplementationOnce(() => {
      // Use spy
      throw zodError;
    });
    const formattedErrorResult = {
      success: false,
      error: "Validation Failed",
    } as CallToolResult;
    (formatError as jest.Mock).mockReturnValueOnce(formattedErrorResult);

    const result = await searchVideosHandler(mockParams, mockVideoManager);

    expect(parseSpy).toHaveBeenCalledWith(mockParams); // Check spy
    expect(formatError).toHaveBeenCalledWith(zodError);
    expect(result).toEqual(formattedErrorResult);
    expect(mockVideoManager.searchVideos).not.toHaveBeenCalled();
  });

  it("should call videoManager.searchVideos with validated params and correctly transform results to LeanVideoSearchResult", async () => {
    const mockParams = { query: "valid query", maxResults: 5 };
    const validatedParams = {
      query: "valid query",
      maxResults: 5,
      order: "relevance",
    };

    const mockYoutubeSearchResults: youtube_v3.Schema$SearchResult[] = [
      {
        id: { videoId: "vid1" },
        snippet: {
          title: "Video 1 Title",
          description: "Desc 1",
          channelId: "chan1",
          channelTitle: "Channel 1",
          publishedAt: "2023-01-01T00:00:00Z",
        },
      },
      {
        id: { videoId: "vid2" },
        snippet: {
          title: "Video 2 Title",
          channelId: "chan2",
          channelTitle: "Channel 2",
          publishedAt: "2023-01-02T00:00:00Z",
        },
      },
      {
        id: { kind: "youtube#searchResult", etag: "etag" },
        snippet: { title: "No Video ID here" },
      },
    ];

    const expectedLeanResults: LeanVideoSearchResult[] = [
      {
        videoId: "vid1",
        title: "Video 1 Title",
        descriptionSnippet: "Desc 1",
        channelId: "chan1",
        channelTitle: "Channel 1",
        publishedAt: "2023-01-01T00:00:00Z",
      },
      {
        videoId: "vid2",
        title: "Video 2 Title",
        descriptionSnippet: null,
        channelId: "chan2",
        channelTitle: "Channel 2",
        publishedAt: "2023-01-02T00:00:00Z",
      },
      {
        videoId: null,
        title: "No Video ID here",
        descriptionSnippet: null,
        channelId: null,
        channelTitle: null,
        publishedAt: null,
      },
    ];
    const mockFormattedSuccessResponse = {
      success: true,
      data: expectedLeanResults,
    } as CallToolResult;

    parseSpy.mockReturnValueOnce(validatedParams); // Use spy
    (mockVideoManager.searchVideos as jest.Mock).mockResolvedValueOnce(
      mockYoutubeSearchResults
    );
    (formatSuccess as jest.Mock).mockReturnValueOnce(
      mockFormattedSuccessResponse
    );

    const result = await searchVideosHandler(mockParams, mockVideoManager);

    expect(parseSpy).toHaveBeenCalledWith(mockParams); // Check spy
    expect(mockVideoManager.searchVideos).toHaveBeenCalledWith({
      query: validatedParams.query,
      maxResults: validatedParams.maxResults,
      order: validatedParams.order,
      type: undefined,
      channelId: undefined,
      videoDuration: undefined,
      publishedAfter: undefined,
      recency: undefined,
      regionCode: undefined,
    });
    expect(formatSuccess).toHaveBeenCalledWith(expectedLeanResults);
    expect(result).toEqual(mockFormattedSuccessResponse);
  });

  it("should call formatError if videoManager.searchVideos throws an error", async () => {
    const mockParams = { query: "a query that causes error" };
    const validatedParams = {
      query: "a query that causes error",
      maxResults: 10,
    };
    const apiError = new Error("YouTube API Error");
    const formattedErrorResult = {
      success: false,
      error: "API Error Occurred",
    } as CallToolResult;

    parseSpy.mockReturnValueOnce(validatedParams); // Use spy
    (mockVideoManager.searchVideos as jest.Mock).mockRejectedValueOnce(
      apiError
    );
    (formatError as jest.Mock).mockReturnValueOnce(formattedErrorResult);

    const result = await searchVideosHandler(mockParams, mockVideoManager);

    expect(parseSpy).toHaveBeenCalledWith(mockParams); // Check spy
    expect(mockVideoManager.searchVideos).toHaveBeenCalledWith({
      query: validatedParams.query,
      maxResults: validatedParams.maxResults,
      order: undefined,
      type: undefined,
      channelId: undefined,
      videoDuration: undefined,
      publishedAfter: undefined,
      recency: undefined,
      regionCode: undefined,
    });
    expect(formatError).toHaveBeenCalledWith(apiError);
    expect(formatSuccess).not.toHaveBeenCalled();
    expect(result).toEqual(formattedErrorResult);
  });
});
