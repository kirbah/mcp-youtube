import { executeInitialCandidateSearch } from "../phase1-candidate-search";
import { CacheService } from "../../cache.service";
import { YoutubeService } from "../../../services/youtube.service";
import { FindConsistentOutlierChannelsOptions } from "../../../types/analyzer.types";
import { youtube_v3 } from "googleapis";

// Mock YoutubeService
const mockYoutubeServiceSearchVideos = jest.fn();

jest.mock("../../../services/youtube.service", () => {
  return {
    YoutubeService: jest.fn().mockImplementation(() => {
      return {
        searchVideos: mockYoutubeServiceSearchVideos,
        // Add other methods if they are called by executeInitialCandidateSearch
        // For now, only searchVideos is directly called.
      };
    }),
  };
});

describe("executeInitialCandidateSearch", () => {
  let mockYoutubeService: jest.Mocked<YoutubeService>;
  let defaultOptions: FindConsistentOutlierChannelsOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    mockYoutubeService = new YoutubeService({} as any);

    defaultOptions = {
      query: "test query",
      channelAge: "NEW",
      consistencyLevel: "MODERATE",
      outlierMagnitude: "STANDARD",
      maxResults: 50,
    };
  });

  it("should fetch results using youtubeService.searchVideos", async () => {
    const fetchedResults: youtube_v3.Schema$SearchResult[] = [
      { snippet: { channelId: "channel3" } },
      { snippet: { channelId: "channel4" } },
      { snippet: { channelId: "channel3" } },
    ];
    const expectedChannelIds = ["channel3", "channel4"];

    mockYoutubeServiceSearchVideos.mockResolvedValue(fetchedResults);

    const result = await executeInitialCandidateSearch(
      defaultOptions,
      mockYoutubeService
    );

    expect(mockYoutubeServiceSearchVideos).toHaveBeenCalledTimes(1);
    expect(mockYoutubeServiceSearchVideos).toHaveBeenCalledWith({
      query: defaultOptions.query,
      publishedAfter: expect.any(String),
      type: "video",
      order: "relevance",
      maxResults: 50,
      regionCode: undefined,
      videoCategoryId: undefined,
    });
    expect(result).toEqual(expect.arrayContaining(expectedChannelIds));
    expect(result.length).toBe(expectedChannelIds.length);
  });

  it("should throw a user-friendly quota error if youtubeService.searchVideos fails with quota error", async () => {
    const quotaError = {
      code: 403,
      errors: [{ reason: "quotaExceeded", message: "Quota exceeded." }],
    };
    mockYoutubeServiceSearchVideos.mockRejectedValue(quotaError);

    await expect(
      executeInitialCandidateSearch(defaultOptions, mockYoutubeService)
    ).rejects.toThrow("YouTube API quota exceeded during Phase 1.");

    expect(mockYoutubeServiceSearchVideos).toHaveBeenCalledTimes(1);
  });

  it("should throw a generic phase 1 error if youtubeService.searchVideos fails with a non-quota error", async () => {
    const genericError = new Error("Some other API error");
    mockYoutubeServiceSearchVideos.mockRejectedValue(genericError);

    await expect(
      executeInitialCandidateSearch(defaultOptions, mockYoutubeService)
    ).rejects.toThrow("Phase 1 failed: Some other API error");

    expect(mockYoutubeServiceSearchVideos).toHaveBeenCalledTimes(1);
  });

  it("should correctly extract unique channel IDs from search results", async () => {
    const searchResultsWithDuplicates: youtube_v3.Schema$SearchResult[] = [
      { snippet: { channelId: "channel1" } },
      { snippet: { channelId: "channel2" } },
      { snippet: { channelId: "channel1" } },
      { snippet: { channelId: "channel3" } },
      { snippet: { channelId: "channel2" } },
      { snippet: {} },
      { snippet: { channelId: undefined } },
    ];
    const expectedChannelIds = ["channel1", "channel2", "channel3"];

    mockYoutubeServiceSearchVideos.mockResolvedValue(
      searchResultsWithDuplicates
    );

    const result = await executeInitialCandidateSearch(
      defaultOptions,
      mockYoutubeService
    );

    expect(result).toEqual(expect.arrayContaining(expectedChannelIds));
    expect(result.length).toBe(expectedChannelIds.length);
  });

  it("should pass optional parameters like regionCode and videoCategoryId to searchVideos", async () => {
    const optionsWithExtras: FindConsistentOutlierChannelsOptions = {
      ...defaultOptions,
      regionCode: "US",
      videoCategoryId: "10",
      channelAge: "ESTABLISHED",
    };

    mockYoutubeServiceSearchVideos.mockResolvedValue([]);

    await executeInitialCandidateSearch(optionsWithExtras, mockYoutubeService);

    expect(mockYoutubeServiceSearchVideos).toHaveBeenCalledWith({
      query: optionsWithExtras.query,
      publishedAfter: expect.any(String),
      type: "video",
      order: "relevance",
      maxResults: 50,
      regionCode: "US",
      videoCategoryId: "10",
    });
  });
});
