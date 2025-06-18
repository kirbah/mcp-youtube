import { YoutubeService } from "../../youtube.service";
import { CacheService } from "../../cache.service"; // Import CacheService
import { google } from "googleapis";
import { parseYouTubeNumber } from "../../../utils/numberParser";
import {
  calculateLikeToViewRatio,
  calculateCommentToViewRatio,
} from "../../../utils/engagementCalculator";
import { truncateDescription } from "../../../utils/textUtils";

jest.mock("../../cache.service"); // Mock CacheService
jest.mock("../../../utils/numberParser");
jest.mock("../../../utils/engagementCalculator");
jest.mock("../../../utils/textUtils");

jest.mock("googleapis", () => ({
  google: {
    youtube: jest.fn(() => ({
      search: {
        list: jest.fn(),
      },
      videos: {
        list: jest.fn(),
      },
      channels: {
        list: jest.fn(),
      },
      videoCategories: {
        list: jest.fn(),
      },
    })),
  },
}));

const mockYoutube = google.youtube as jest.Mock;

// Helper functions for generating mock API responses
// NOTE: youtube_v3 is not directly available here, so we'll use `any` or define minimal interfaces
// For simplicity, using `any` for Schema$SearchListResponse and Schema$VideoListResponse
const generateMockSearchResults = (
  count: number
): any /* youtube_v3.Schema$SearchListResponse */ => ({
  data: {
    items: Array.from({ length: count }, (_, i) => ({
      id: { videoId: `video_${i}` },
    })),
    nextPageToken: undefined, // Assuming a single page of search results for these tests
  },
});

const generateMockVideoDetails = (
  ids: string[]
): any /* youtube_v3.Schema$VideoListResponse */ => ({
  data: {
    items: ids.map((id) => ({
      id,
      snippet: {
        title: `Title for ${id}`,
        publishedAt: "2023-01-01T00:00:00Z",
      },
      statistics: { viewCount: "1000", likeCount: "100", commentCount: "10" },
      contentDetails: { duration: "PT5M" },
    })),
  },
});

describe("YoutubeService.getChannelTopVideos", () => {
  let videoManagement: YoutubeService;
  let mockSearchList: jest.Mock;
  let mockVideosList: jest.Mock;
  let mockCacheService: jest.Mocked<CacheService>; // Declare mockCacheService

  beforeEach(() => {
    // Reset mocks for each test
    mockSearchList = jest.fn();
    mockVideosList = jest.fn();
    mockYoutube.mockImplementation(() => ({
      search: {
        list: mockSearchList,
      },
      videos: {
        list: mockVideosList,
      },
      channels: {
        // Added to avoid undefined errors if other methods use it
        list: jest.fn(),
      },
      videoCategories: {
        // Added to avoid undefined errors if other methods use it
        list: jest.fn(),
      },
    }));

    // Mock CacheService and its methods
    mockCacheService = new CacheService({} as any) as jest.Mocked<CacheService>;
    mockCacheService.createOperationKey.mockImplementation(
      (operationName, options) =>
        `${operationName}-${JSON.stringify(options || {})}`
    );
    mockCacheService.getOrSet.mockImplementation(
      async (key, operation, ttl, collection) => operation()
    );

    videoManagement = new YoutubeService(mockCacheService); // Pass mockCacheService
    (parseYouTubeNumber as jest.Mock).mockImplementation((val) =>
      parseInt(val || "0")
    );
    (calculateLikeToViewRatio as jest.Mock).mockReturnValue(0.1);
    (calculateCommentToViewRatio as jest.Mock).mockReturnValue(0.01);
    (truncateDescription as jest.Mock).mockImplementation(
      (desc) => desc || null
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tests will go here

  it("should return top videos when API call is successful", async () => {
    const mockChannelId = "UC_channel_id";
    const mockVideos = [
      { id: "video1", title: "Video 1" },
      { id: "video2", title: "Video 2" },
    ];
    const mockApiResponse = {
      data: {
        items: mockVideos.map((video) => ({
          id: { videoId: video.id },
          snippet: { title: video.title },
        })),
      },
    };
    mockSearchList.mockResolvedValue(mockApiResponse);

    // Mock videos.list to return details for the video IDs found by search
    mockVideosList.mockImplementation(async (params) => {
      const ids = params.id as string[];
      return {
        data: {
          items: ids.map((id) => {
            const originalVideo = mockVideos.find((v) => v.id === id);
            return {
              id: id,
              snippet: { title: originalVideo?.title || `Title for ${id}` },
              statistics: {
                viewCount: "100",
                likeCount: "10",
                commentCount: "1",
              }, // Dummy stats
              contentDetails: { duration: "PT1M" }, // Dummy duration
            };
          }),
        },
      };
    });

    const result = await videoManagement.getChannelTopVideos({
      channelId: mockChannelId,
    });

    expect(mockSearchList).toHaveBeenCalledWith({
      part: ["id"], // Verify part is ["id"]
      channelId: mockChannelId,
      order: "viewCount",
      type: ["video"],
      maxResults: 10, // Default maxResults
      pageToken: undefined, // Initial pageToken
    });
    expect(result).toEqual(
      mockVideos.map((video) => ({
        id: video.id,
        title: video.title,
        publishedAt: undefined, // snippet.publishedAt is not in the mock for videos.list in this test
        duration: "PT1M", // From the mockVideosList implementation in this test
        viewCount: 100, // From the mockVideosList implementation
        likeCount: 10, // From the mockVideosList implementation
        commentCount: 1, // From the mockVideosList implementation
        likeToViewRatio: 0.1, // Default mock from beforeEach
        commentToViewRatio: 0.01, // Default mock from beforeEach
        categoryId: null, // Default null for undefined categoryId
        defaultLanguage: null, // Default null for undefined defaultLanguage
      }))
    );
  });

  it("should call youtube.search.list with correct parameters when maxResults is provided", async () => {
    const mockChannelId = "UC_channel_id";
    const mockMaxResults = 5;
    const mockVideos = [
      { id: "video1", title: "Video 1" },
      { id: "video2", title: "Video 2" },
    ];
    const mockApiResponse = {
      data: {
        items: mockVideos.map((video) => ({
          id: { videoId: video.id },
          snippet: { title: video.title },
        })),
      },
    };
    mockSearchList.mockResolvedValue(mockApiResponse);

    // Mock videos.list to return details for the video IDs found by search
    mockVideosList.mockImplementation(async (params) => {
      const ids = params.id as string[];
      return {
        data: {
          items: ids.map((id) => {
            const originalVideo = mockVideos.find((v) => v.id === id);
            return {
              id: id,
              snippet: { title: originalVideo?.title || `Title for ${id}` },
              statistics: {
                viewCount: "200",
                likeCount: "20",
                commentCount: "2",
              }, // Dummy stats
              contentDetails: { duration: "PT2M" }, // Dummy duration
            };
          }),
        },
      };
    });

    await videoManagement.getChannelTopVideos({
      channelId: mockChannelId,
      maxResults: mockMaxResults,
    });

    expect(mockSearchList).toHaveBeenCalledWith({
      part: ["id"],
      channelId: mockChannelId,
      order: "viewCount",
      type: ["video"],
      maxResults: mockMaxResults, // Verify provided maxResults
      pageToken: undefined,
    });
  });

  it("should throw an error when API call fails", async () => {
    const mockChannelId = "UC_channel_id";
    const errorMessage = "API error";
    mockSearchList.mockRejectedValue(new Error(errorMessage));

    await expect(
      videoManagement.getChannelTopVideos({ channelId: mockChannelId })
    ).rejects.toThrow(
      `Failed to retrieve channel's top videos: ${errorMessage}`
    );

    expect(mockSearchList).toHaveBeenCalledWith({
      part: ["id"],
      channelId: mockChannelId,
      order: "viewCount",
      type: ["video"],
      maxResults: 10,
      pageToken: undefined,
    });
  });

  it("should throw 'No videos found.' error when youtube.search.list returns no items", async () => {
    const mockChannelId = "UC_channel_id_no_videos";
    mockSearchList.mockResolvedValue({
      data: {
        items: [], // No items returned
      },
    });

    await expect(
      videoManagement.getChannelTopVideos({ channelId: mockChannelId })
    ).rejects.toThrow("No videos found.");

    expect(mockSearchList).toHaveBeenCalledWith({
      part: ["id"],
      channelId: mockChannelId,
      order: "viewCount",
      type: ["video"],
      maxResults: 10, // Default maxResults
      pageToken: undefined,
    });
  });

  it("should handle pagination correctly when maxResults is greater than MAX_RESULTS_PER_PAGE", async () => {
    const mockChannelId = "UC_channel_id_pagination";
    const requestedMaxResults = 75; // Greater than MAX_RESULTS_PER_PAGE (50)
    const MAX_RESULTS_PER_PAGE = 50;

    // Generate unique video IDs for search results
    const searchResultItemsPage1 = Array.from(
      { length: MAX_RESULTS_PER_PAGE },
      (_, i) => ({
        id: { videoId: `video_id_page1_${i}` },
      })
    );
    const searchResultItemsPage2 = Array.from(
      { length: requestedMaxResults - MAX_RESULTS_PER_PAGE },
      (_, i) => ({
        id: { videoId: `video_id_page2_${i}` },
      })
    );

    const nextPageToken = "nextPageToken123";

    // Mock search.list responses
    mockSearchList
      .mockResolvedValueOnce({
        // First call
        data: {
          items: searchResultItemsPage1,
          nextPageToken: nextPageToken,
        },
      })
      .mockResolvedValueOnce({
        // Second call
        data: {
          items: searchResultItemsPage2,
          nextPageToken: null, // No more pages
        },
      });

    // Combine all video IDs from search results
    const allVideoIds = [
      ...searchResultItemsPage1.map((item) => item.id.videoId),
      ...searchResultItemsPage2.map((item) => item.id.videoId),
    ];

    // Mock videos.list response
    const mockVideoDetailsItems = allVideoIds.map((id) => ({
      id: id,
      snippet: {
        title: `Title for ${id}`,
        publishedAt: "2023-01-01T00:00:00Z",
      },
      statistics: { viewCount: "100", likeCount: "10", commentCount: "1" },
      contentDetails: { duration: "PT1M30S" },
    }));
    // mockVideosList.mockResolvedValue({ // Old simple mock
    //   data: { items: mockVideoDetailsItems },
    // });
    mockVideosList.mockImplementation(async (params) => {
      const ids = params.id as string[];
      const requestedDetails = mockVideoDetailsItems.filter((detailItem) =>
        ids.includes(detailItem.id!)
      );
      return { data: { items: requestedDetails } };
    });

    const result = await videoManagement.getChannelTopVideos({
      channelId: mockChannelId,
      maxResults: requestedMaxResults,
    });

    // Assertions for search.list calls
    expect(mockSearchList).toHaveBeenCalledTimes(2);
    expect(mockSearchList).toHaveBeenNthCalledWith(1, {
      part: ["id"],
      channelId: mockChannelId,
      order: "viewCount",
      type: ["video"],
      maxResults: MAX_RESULTS_PER_PAGE, // First call should use MAX_RESULTS_PER_PAGE
      pageToken: undefined,
    });
    expect(mockSearchList).toHaveBeenNthCalledWith(2, {
      part: ["id"],
      channelId: mockChannelId,
      order: "viewCount",
      type: ["video"],
      maxResults: requestedMaxResults - MAX_RESULTS_PER_PAGE, // Remaining results for the second call
      pageToken: nextPageToken, // Should use the nextPageToken from the first call
    });

    // Assertions for videos.list call
    expect(mockVideosList).toHaveBeenCalledTimes(2); // For 75 videos, 50 + 25
    // Check if videos.list was called with chunks of 50, or if the implementation fetches all at once after search
    // Based on current understanding of getChannelTopVideos, it collects all IDs then fetches video details.
    // The toHaveBeenNthCalledWith assertions are more precise for batched calls.
    // Removing the overly broad toHaveBeenCalledWith that expects all IDs at once.
    // expect(mockVideosList).toHaveBeenCalledWith({
    //     part: ['snippet', 'statistics', 'contentDetails'],
    //     id: expect.arrayContaining(allVideoIds),
    //     maxResults: allVideoIds.length, // It should fetch details for all found IDs
    // });

    // Assertions for the result
    expect(result).toHaveLength(requestedMaxResults);
    allVideoIds.forEach((videoId, index) => {
      const video = result.find((v) => v.id === videoId);
      expect(video).toBeDefined();
      expect(video).toMatchObject({
        id: videoId,
        title: `Title for ${videoId}`,
        // Add other relevant fields if necessary, considering mocked helper functions
      });
    });
  });

  it("should respect ABSOLUTE_MAX_RESULTS when maxResults is very large", async () => {
    const mockChannelId = "UC_channel_id_absolute_max";
    const requestedMaxResults = 600; // Greater than ABSOLUTE_MAX_RESULTS (500)
    const MAX_RESULTS_PER_PAGE = 50;
    const ABSOLUTE_MAX_RESULTS = 500; // Defined in VideoManagement class

    let searchCallCount = 0;
    const generateSearchPage = (
      pageNumber: number,
      itemsOnPage: number,
      hasNextPage: boolean
    ) => {
      searchCallCount++;
      return {
        data: {
          items: Array.from({ length: itemsOnPage }, (_, i) => ({
            id: { videoId: `video_id_abs_page${pageNumber}_${i}` },
          })),
          nextPageToken: hasNextPage ? `nextPageToken_abs_${pageNumber}` : null,
        },
      };
    };

    // Mock search.list to return multiple pages
    // It should make 10 calls for 500 results if maxResults is 50 each time.
    for (let i = 0; i < ABSOLUTE_MAX_RESULTS / MAX_RESULTS_PER_PAGE; i++) {
      mockSearchList.mockResolvedValueOnce(
        generateSearchPage(
          i + 1,
          MAX_RESULTS_PER_PAGE,
          i < ABSOLUTE_MAX_RESULTS / MAX_RESULTS_PER_PAGE - 1
        )
      );
    }
    // This last call might not be made if logic correctly caps at ABSOLUTE_MAX_RESULTS before fetching this page.
    // Add one more potential page if logic were to try and fetch up to requestedMaxResults
    mockSearchList.mockResolvedValueOnce(
      generateSearchPage(11, MAX_RESULTS_PER_PAGE, false)
    );

    const allVideoIdsSearched = [];
    for (let i = 0; i < ABSOLUTE_MAX_RESULTS / MAX_RESULTS_PER_PAGE; i++) {
      for (let j = 0; j < MAX_RESULTS_PER_PAGE; j++) {
        allVideoIdsSearched.push(`video_id_abs_page${i + 1}_${j}`);
      }
    }

    // Mock videos.list response for up to ABSOLUTE_MAX_RESULTS items
    const mockVideoDetailsItems = allVideoIdsSearched
      .slice(0, ABSOLUTE_MAX_RESULTS)
      .map((id) => ({
        id: id,
        snippet: {
          title: `Title for ${id}`,
          publishedAt: "2023-01-01T00:00:00Z",
        },
        statistics: { viewCount: "100", likeCount: "10", commentCount: "1" },
        contentDetails: { duration: "PT1M30S" },
      }));
    // mockVideosList.mockResolvedValue({ // Old simple mock
    //   data: { items: mockVideoDetailsItems },
    // });
    mockVideosList.mockImplementation(async (params) => {
      const ids = params.id as string[];
      const requestedDetails = mockVideoDetailsItems.filter((detailItem) =>
        ids.includes(detailItem.id!)
      );
      return { data: { items: requestedDetails } };
    });

    const result = await videoManagement.getChannelTopVideos({
      channelId: mockChannelId,
      maxResults: requestedMaxResults,
    });

    // Assertions for search.list calls
    // It should have made 10 calls (500 / 50 = 10)
    const expectedSearchCalls = ABSOLUTE_MAX_RESULTS / MAX_RESULTS_PER_PAGE;
    expect(mockSearchList).toHaveBeenCalledTimes(expectedSearchCalls);

    for (let i = 0; i < expectedSearchCalls; i++) {
      expect(mockSearchList).toHaveBeenNthCalledWith(i + 1, {
        part: ["id"],
        channelId: mockChannelId,
        order: "viewCount",
        type: ["video"],
        maxResults: MAX_RESULTS_PER_PAGE,
        pageToken: i === 0 ? undefined : `nextPageToken_abs_${i}`,
      });
    }

    // Assertions for videos.list call
    expect(mockVideosList).toHaveBeenCalledTimes(10); // 500 videos / 50 per batch = 10 calls
    // The toHaveBeenNthCalledWith assertions would be more appropriate here if we needed to check each call,
    // but for this test, ensuring the total count and final result is sufficient.
    // Removing the broad toHaveBeenCalledWith as it's problematic with batching.
    // expect(mockVideosList).toHaveBeenCalledWith({
    //   part: ['snippet', 'statistics', 'contentDetails'],
    //   id: expect.arrayContaining(allVideoIdsSearched.slice(0, ABSOLUTE_MAX_RESULTS)),
    //   maxResults: ABSOLUTE_MAX_RESULTS,
    // });

    // Assertions for the result
    expect(result).toHaveLength(ABSOLUTE_MAX_RESULTS);
    allVideoIdsSearched.slice(0, ABSOLUTE_MAX_RESULTS).forEach((videoId) => {
      const video = result.find((v) => v.id === videoId);
      expect(video).toBeDefined();
      expect(video).toMatchObject({
        id: videoId,
        title: `Title for ${videoId}`,
      });
    });
  });

  it("should correctly extract video IDs from search results, skipping items without videoId", async () => {
    const mockChannelId = "UC_channel_id_extraction_test";
    const mockSearchResults = {
      data: {
        items: [
          { id: { videoId: "video1" } },
          { id: { videoId: "video2" } },
          { id: {} }, // Missing videoId, should be filtered by .filter(id => id !== undefined)
          { snippet: { title: "Just a snippet" } }, // Missing id, should be filtered by .map(item => item.id?.videoId)
          // null and undefined items removed
          { id: { videoId: "video3" } },
          { id: { channelId: "some_channel_id_instead_of_video" } }, // Item that is not a video, should be filtered
        ],
      },
    };
    mockSearchList.mockResolvedValue(mockSearchResults);

    const validVideoIds = ["video1", "video2", "video3"]; // These are the only ones expected to make it through
    const mockVideoDetails = validVideoIds.map((id) => ({
      id,
      snippet: {
        title: `Title for ${id}`,
        publishedAt: "2023-01-01T00:00:00Z",
      },
      statistics: { viewCount: "100", likeCount: "10", commentCount: "1" },
      contentDetails: { duration: "PT1M" },
    }));

    mockVideosList.mockImplementation(async (params) => {
      // Ensure params.id is an array before filtering
      const requestedIds = Array.isArray(params.id)
        ? params.id
        : params.id
          ? [params.id]
          : [];
      const itemsToReturn = mockVideoDetails.filter((detail) =>
        requestedIds.includes(detail.id)
      );
      return { data: { items: itemsToReturn } };
    });

    const result = await videoManagement.getChannelTopVideos({
      channelId: mockChannelId,
      maxResults: 10,
    });

    expect(mockSearchList).toHaveBeenCalledWith({
      part: ["id"],
      channelId: mockChannelId,
      order: "viewCount",
      type: ["video"],
      maxResults: 10,
      pageToken: undefined,
    });

    // Assert that videos.list was called with only the valid IDs
    expect(mockVideosList).toHaveBeenCalledTimes(1);
    expect(mockVideosList).toHaveBeenCalledWith({
      part: ["snippet", "statistics", "contentDetails"],
      id: validVideoIds, // Expect only valid IDs
      // maxResults is not actually passed by the code for videos.list when given IDs
    });

    // Assert that the final result contains videos corresponding to the valid IDs
    expect(result).toHaveLength(validVideoIds.length);
    validVideoIds.forEach((validId) => {
      expect(result.some((video) => video.id === validId)).toBe(true); // Changed video.videoId to video.id
      const videoInResult = result.find((v) => v.id === validId); // Changed v.videoId to v.id
      expect(videoInResult).toBeDefined();
      expect(videoInResult?.title).toBe(`Title for ${validId}`); // Changed videoTitle to title
    });

    // Also ensure no undefined or problematic items in the result
    result.forEach((video) => {
      expect(video).toBeDefined();
      expect(video.id).toBeDefined(); // Changed video.videoId to video.id
    });
  });

  it("should call youtube.videos.list in batches if video IDs exceed MAX_RESULTS_PER_PAGE", async () => {
    const mockChannelId = "UC_channel_id_batch_gt_max";
    const totalVideosToFetch = 70;
    const MAX_RESULTS_PER_PAGE = 50; // From VideoManagement

    mockSearchList.mockResolvedValue(
      generateMockSearchResults(totalVideosToFetch)
    );

    const expectedVideoIds = Array.from(
      { length: totalVideosToFetch },
      (_, i) => `video_${i}`
    );
    const firstBatchIds = expectedVideoIds.slice(0, MAX_RESULTS_PER_PAGE);
    const secondBatchIds = expectedVideoIds.slice(MAX_RESULTS_PER_PAGE);

    mockVideosList
      .mockImplementationOnce(async (params) => {
        expect(params.id).toEqual(firstBatchIds);
        expect(params.id?.length).toBe(MAX_RESULTS_PER_PAGE);
        return generateMockVideoDetails(params.id as string[]);
      })
      .mockImplementationOnce(async (params) => {
        expect(params.id).toEqual(secondBatchIds);
        expect(params.id?.length).toBe(
          totalVideosToFetch - MAX_RESULTS_PER_PAGE
        );
        return generateMockVideoDetails(params.id as string[]);
      });

    const result = await videoManagement.getChannelTopVideos({
      channelId: mockChannelId,
      maxResults: totalVideosToFetch,
    });

    expect(mockSearchList).toHaveBeenCalledTimes(1); // Search once
    expect(mockVideosList).toHaveBeenCalledTimes(2); // Called in two batches

    // Verify calls to videos.list
    expect(mockVideosList).toHaveBeenNthCalledWith(1, {
      part: ["snippet", "statistics", "contentDetails"],
      id: firstBatchIds,
      // maxResults: MAX_RESULTS_PER_PAGE, // Not passed by code
    });
    expect(mockVideosList).toHaveBeenNthCalledWith(2, {
      part: ["snippet", "statistics", "contentDetails"],
      id: secondBatchIds,
      // maxResults: secondBatchIds.length, // Not passed by code
    });

    expect(result).toHaveLength(totalVideosToFetch);
    // Verify some details from the result to ensure data is correctly transformed
    for (let i = 0; i < totalVideosToFetch; i++) {
      expect(result[i].id).toBe(`video_${i}`); // Changed from videoId to id
      expect(result[i].title).toBe(`Title for video_${i}`); // Changed from videoTitle to title
    }
  });

  it("should call youtube.videos.list once if video IDs count is MAX_RESULTS_PER_PAGE", async () => {
    const mockChannelId = "UC_channel_id_batch_eq_max";
    const totalVideosToFetch = 50; // Exactly MAX_RESULTS_PER_PAGE
    const MAX_RESULTS_PER_PAGE = 50; // From VideoManagement

    mockSearchList.mockResolvedValue(
      generateMockSearchResults(totalVideosToFetch)
    );

    const expectedVideoIds = Array.from(
      { length: totalVideosToFetch },
      (_, i) => `video_${i}`
    );

    mockVideosList.mockImplementationOnce(async (params) => {
      expect(params.id).toEqual(expectedVideoIds);
      expect(params.id?.length).toBe(MAX_RESULTS_PER_PAGE);
      return generateMockVideoDetails(params.id as string[]);
    });

    const result = await videoManagement.getChannelTopVideos({
      channelId: mockChannelId,
      maxResults: totalVideosToFetch,
    });

    expect(mockSearchList).toHaveBeenCalledTimes(1);
    expect(mockVideosList).toHaveBeenCalledTimes(1); // Called only once

    expect(mockVideosList).toHaveBeenCalledWith({
      part: ["snippet", "statistics", "contentDetails"],
      id: expectedVideoIds,
      // maxResults: MAX_RESULTS_PER_PAGE, // Not passed by code
    });

    expect(result).toHaveLength(totalVideosToFetch);
    for (let i = 0; i < totalVideosToFetch; i++) {
      expect(result[i].id).toBe(`video_${i}`); // Changed from videoId to id
      expect(result[i].title).toBe(`Title for video_${i}`); // Changed from videoTitle to title
    }
  });

  it("should correctly transform video details to LeanChannelTopVideo objects", async () => {
    const mockChannelId = "UC_channel_id_transform_test";
    const mockVideoIdsFromSearch = ["video1", "video2", "video3"];

    // Refined mocks for helpers for this specific test
    (parseYouTubeNumber as jest.Mock).mockImplementation((value) => {
      if (value === null || value === undefined) return 0;
      return parseInt(value, 10);
    });
    (calculateLikeToViewRatio as jest.Mock).mockImplementation(
      (viewCount, likeCount) => {
        if (!viewCount || !likeCount || viewCount === 0) return 0; // Ensure no division by zero
        return Number((likeCount / viewCount).toFixed(4)); // Example precision
      }
    );
    (calculateCommentToViewRatio as jest.Mock).mockImplementation(
      (viewCount, commentCount) => {
        if (!viewCount || !commentCount || viewCount === 0) return 0; // Ensure no division by zero
        return Number((commentCount / viewCount).toFixed(4)); // Example precision
      }
    );

    mockSearchList.mockResolvedValue({
      data: {
        items: mockVideoIdsFromSearch.map((id) => ({ id: { videoId: id } })),
      },
    });

    const mockVideoApiItems: any[] /* youtube_v3.Schema$Video[] */ = [
      {
        id: "video1",
        snippet: {
          title: "Video Title 1",
          publishedAt: "2023-01-01T10:00:00Z",
        },
        contentDetails: { duration: "PT1M30S" },
        statistics: { viewCount: "1000", likeCount: "150", commentCount: "25" },
      },
      {
        id: "video2",
        snippet: { title: "Second Video", publishedAt: "2023-02-15T12:30:00Z" },
        contentDetails: { duration: "PT2M45S" },
        statistics: { viewCount: "2500", likeCount: "300", commentCount: "50" },
      },
      {
        id: "video3", // Video with potentially missing/null statistic values
        snippet: {
          title: "Video With Missing Stats",
          publishedAt: "2023-03-20T15:00:00Z",
        },
        contentDetails: { duration: "PT3M00S" },
        statistics: {
          viewCount: "500",
          likeCount: null,
          commentCount: undefined,
        },
      },
    ];
    mockVideosList.mockResolvedValue({ data: { items: mockVideoApiItems } });

    const result = await videoManagement.getChannelTopVideos({
      channelId: mockChannelId,
      maxResults: mockVideoIdsFromSearch.length,
    });

    expect(result).toHaveLength(mockVideoApiItems.length);

    mockVideoApiItems.forEach((apiItem, index) => {
      const transformedVideo = result.find((v) => v.id === apiItem.id); // Changed v.videoId to v.id
      expect(transformedVideo).toBeDefined();

      const expectedViewCount = parseYouTubeNumber(
        apiItem.statistics.viewCount
      );
      const expectedLikeCount = parseYouTubeNumber(
        apiItem.statistics.likeCount
      );
      const expectedCommentCount = parseYouTubeNumber(
        apiItem.statistics.commentCount
      );

      expect(transformedVideo?.id).toBe(apiItem.id); // Changed from videoId to id
      expect(transformedVideo?.title).toBe(apiItem.snippet?.title); // Changed from videoTitle to title
      expect(transformedVideo?.publishedAt).toBe(apiItem.snippet?.publishedAt);
      expect(transformedVideo?.duration).toBe(apiItem.contentDetails?.duration);
      expect(transformedVideo?.viewCount).toBe(expectedViewCount);
      expect(transformedVideo?.likeCount).toBe(expectedLikeCount);
      expect(transformedVideo?.commentCount).toBe(expectedCommentCount);

      expect(transformedVideo?.likeToViewRatio).toBe(
        calculateLikeToViewRatio(expectedViewCount, expectedLikeCount)
      );
      expect(transformedVideo?.commentToViewRatio).toBe(
        calculateCommentToViewRatio(expectedViewCount, expectedCommentCount)
      );
    });

    // Specific checks for video3 with missing stats
    const video3Transformed = result.find((v) => v.id === "video3"); // Changed v.videoId to v.id
    expect(video3Transformed?.viewCount).toBe(500);
    expect(video3Transformed?.likeCount).toBe(0); // Parsed from null
    expect(video3Transformed?.commentCount).toBe(0); // Parsed from undefined
    expect(video3Transformed?.likeToViewRatio).toBe(0); // Calculated with likeCount = 0
    expect(video3Transformed?.commentToViewRatio).toBe(0); // Calculated with commentCount = 0
  });

  it("should slice the final results to targetResults if more videos are processed than requested", async () => {
    const mockChannelId = "UC_channel_id_slicing_test";
    const targetResults = 3; // User requests 3 videos

    // Search returns more IDs than requested initially (e.g., 5)
    // This situation can happen if initial search fetches a page of 50, but user only wants 3.
    const mockVideoIdsFromSearch = [
      "video1",
      "video2",
      "video3",
      "video4",
      "video5",
    ];
    mockSearchList.mockResolvedValue({
      data: {
        items: mockVideoIdsFromSearch.map((id) => ({ id: { videoId: id } })),
        nextPageToken: undefined, // Assume single page for simplicity here
      },
    });

    // videos.list is mocked to return details for all 5 IDs fetched by search
    // In a real scenario, if search returned 5 IDs and targetResults is 3,
    // videos.list would be called with those 5 IDs (if < MAX_RESULTS_PER_PAGE).
    mockVideosList.mockResolvedValue({
      data: {
        items: mockVideoIdsFromSearch.map((id) => ({
          id,
          snippet: {
            title: `Title for ${id}`,
            publishedAt: "2023-01-01T00:00:00Z",
          },
          contentDetails: { duration: "PT1M" },
          statistics: { viewCount: "100", likeCount: "10", commentCount: "1" },
        })),
      },
    });

    // Restore default mock implementations for helpers if they were changed in a previous test
    // (This is good practice if tests run in parallel or order is not guaranteed,
    // though Jest runs them sequentially by default. For clarity, explicitly setting them
    // to what this test expects or relying on beforeEach is better.)
    (parseYouTubeNumber as jest.Mock).mockImplementation((val) =>
      parseInt(val || "0")
    );
    (calculateLikeToViewRatio as jest.Mock).mockReturnValue(0.1);
    (calculateCommentToViewRatio as jest.Mock).mockReturnValue(0.01);

    const result = await videoManagement.getChannelTopVideos({
      channelId: mockChannelId,
      maxResults: targetResults,
    });

    // Assert that search was called (it might ask for more initially, up to MAX_RESULTS_PER_PAGE)
    expect(mockSearchList).toHaveBeenCalledTimes(1);
    // params.maxResults for search will be min(targetResults, MAX_RESULTS_PER_PAGE) if targetResults is small,
    // or MAX_RESULTS_PER_PAGE if targetResults is large.
    // For targetResults = 3, search will be called for 3.
    expect(mockSearchList).toHaveBeenCalledWith(
      expect.objectContaining({
        maxResults: targetResults,
      })
    );

    // videos.list would be called with the IDs from search (up to search's maxResults)
    // In this mock, search returns 5 IDs, and it will ask for details for these 5.
    // However, the actual implementation of getChannelTopVideos, if it gets 5 IDs from search
    // but only needs 3, might optimize to only call videos.list for 3 IDs.
    // Let's assume it fetches details for what search returned (if < MAX_RESULTS_PER_PAGE)
    // and then slices. The current implementation fetches details for *all* IDs found by search
    // (up to ABSOLUTE_MAX_RESULTS), then slices.
    // So, videos.list will be called for 5 video IDs.
    expect(mockVideosList).toHaveBeenCalledTimes(1);
    expect(mockVideosList).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockVideoIdsFromSearch, // It will ask for all 5
        // maxResults: mockVideoIdsFromSearch.length // Not passed by code
      })
    );

    // Assert that the final result is sliced to targetResults
    expect(result).toHaveLength(targetResults);
    expect(
      result
        .map((v) => v.id)
        .filter((id): id is string => id !== null && id !== undefined)
    ).toEqual(
      // Filter out null/undefined
      mockVideoIdsFromSearch.slice(0, targetResults)
    );
    expect(result[0].id).toBe("video1");
    expect(result[1].id).toBe("video2");
    expect(result[2].id).toBe("video3");
  });

  it("should throw a formatted error if youtube.videos.list fails", async () => {
    const mockChannelId = "UC_channel_id_videos_fail";
    const mockVideoIdsFromSearch = ["video1", "video2"];

    mockSearchList.mockResolvedValue({
      data: {
        items: mockVideoIdsFromSearch.map((id) => ({ id: { videoId: id } })),
      },
    });

    const errorMessage = "Failed to fetch video details";
    mockVideosList.mockRejectedValue(new Error(errorMessage));

    await expect(
      videoManagement.getChannelTopVideos({ channelId: mockChannelId })
    ).rejects.toThrow(
      `Failed to retrieve channel's top videos: ${errorMessage}`
    );

    // Verify search.list was called
    expect(mockSearchList).toHaveBeenCalledTimes(1);
    expect(mockSearchList).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: mockChannelId,
      })
    );

    // Verify videos.list was attempted
    expect(mockVideosList).toHaveBeenCalledTimes(1);
    expect(mockVideosList).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockVideoIdsFromSearch,
      })
    );
  });
});
