import { VideoManagement, SearchOptions } from "../../videos"; // Adjust path as needed
import { google } from "googleapis";

// Mock the googleapis library
jest.mock("googleapis", () => {
  const mockSearchList = jest.fn();
  return {
    google: {
      youtube: jest.fn(() => ({
        search: {
          list: mockSearchList,
        },
      })),
    },
    // Export the mock function so we can spy on it and change its behavior in tests
    mockSearchList,
  };
});

// Mock environment variables if your class uses them (e.g., API key)
// process.env.YOUTUBE_API_KEY = "test_api_key"; // Set this if needed by the constructor

describe("VideoManagement - searchVideos", () => {
  let videoManagement: VideoManagement;
  // Access the mockSearchList from the mocked googleapis module
  let mockSearchList: jest.Mock;

  beforeEach(() => {
    videoManagement = new VideoManagement();
    // Dynamically import the mockSearchList from the mocked module
    // and assign it to the mockSearchList variable
    mockSearchList = require("googleapis").mockSearchList;
    mockSearchList.mockClear();
  });

  it("should call youtube.search.list with default parameters", async () => {
    const query = "test query";
    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });

    await videoManagement.searchVideos({ query });

    expect(mockSearchList).toHaveBeenCalledWith({
      part: ["snippet"],
      q: query,
      maxResults: 10, // Default maxResults
      type: ["video"], // Default type
      order: "relevance", // Default order
      pageToken: undefined,
    });
  });

  it("should handle empty results from the API", async () => {
    const query = "empty results test";
    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });

    const results = await videoManagement.searchVideos({ query });

    expect(results).toEqual([]);
    expect(mockSearchList).toHaveBeenCalledTimes(1);
  });

  it("should respect maxResults parameter", async () => {
    const query = "maxResults test";
    const maxResults = 5;
    // Mock API to return more items than maxResults to ensure slicing
    const mockItems = Array(10)
      .fill({})
      .map((_, i) => ({ id: { videoId: `video${i}` } }));
    mockSearchList.mockResolvedValueOnce({
      data: { items: mockItems, nextPageToken: "nextPage" },
    });

    const results = await videoManagement.searchVideos({ query, maxResults });

    expect(results.length).toBe(maxResults);
    expect(mockSearchList).toHaveBeenCalledWith(
      expect.objectContaining({
        maxResults: maxResults,
      })
    );
  });

  it("should use calculated publishedAfter when recency is provided", async () => {
    const query = "recency test";
    const recency = "pastWeek";
    const toleranceMilliseconds = 10000; // 10 seconds

    const calculatePublishedAfterSpy = jest.spyOn(
      VideoManagement.prototype as any,
      "calculatePublishedAfter"
    );

    // Calculate expected publishedAfter just before the call
    const expectedTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });
    await videoManagement.searchVideos({ query, recency });

    expect(calculatePublishedAfterSpy).toHaveBeenCalledWith(recency);

    const apiCallArgs = mockSearchList.mock.calls[0][0];
    expect(apiCallArgs.publishedAfter).toEqual(expect.any(String));

    // Validate ISO string format (basic check)
    expect(apiCallArgs.publishedAfter).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );

    const actualPublishedAfterDate = new Date(apiCallArgs.publishedAfter);
    const timeDifference = Math.abs(
      actualPublishedAfterDate.getTime() - expectedTime.getTime()
    );

    expect(timeDifference).toBeLessThanOrEqual(toleranceMilliseconds);
    calculatePublishedAfterSpy.mockRestore();
  });

  it("should handle pagination correctly when maxResults exceeds MAX_RESULTS_PER_PAGE", async () => {
    const query = "pagination test";
    const maxResults = 60; // Assuming MAX_RESULTS_PER_PAGE is 50
    const mockPage1Items = Array(50)
      .fill({})
      .map((_, i) => ({ id: { videoId: `video_page1_${i}` } }));
    const mockPage2Items = Array(10)
      .fill({})
      .map((_, i) => ({ id: { videoId: `video_page2_${i}` } }));

    mockSearchList
      .mockResolvedValueOnce({
        data: { items: mockPage1Items, nextPageToken: "nextPageToken123" },
      })
      .mockResolvedValueOnce({
        data: { items: mockPage2Items, nextPageToken: null },
      }); // No next page token for the second call

    const results = await videoManagement.searchVideos({ query, maxResults });

    expect(results.length).toBe(maxResults);
    expect(mockSearchList).toHaveBeenCalledTimes(2); // Called twice for pagination
    expect(mockSearchList.mock.calls[0][0].maxResults).toBe(50); // First call maxResults
    expect(mockSearchList.mock.calls[0][0].pageToken).toBeUndefined();
    expect(mockSearchList.mock.calls[1][0].maxResults).toBe(10); // Second call remaining results
    expect(mockSearchList.mock.calls[1][0].pageToken).toBe("nextPageToken123");
  });

  it("should limit results to ABSOLUTE_MAX_RESULTS if maxResults is too high", async () => {
    const query = "absolute max test";
    const highMaxResults = 600; // Assuming ABSOLUTE_MAX_RESULTS is 500
    const absoluteMaxResults = 500; // Should match the class constant

    // Mock enough pages to satisfy ABSOLUTE_MAX_RESULTS
    for (let i = 0; i < absoluteMaxResults / 50; i++) {
      const pageItems = Array(50)
        .fill({})
        .map((_, j) => ({ id: { videoId: `video_abs_${i}_${j}` } }));
      mockSearchList.mockResolvedValueOnce({
        data: {
          items: pageItems,
          nextPageToken:
            i < absoluteMaxResults / 50 - 1 ? `nextPage${i}` : null,
        },
      });
    }

    const results = await videoManagement.searchVideos({
      query,
      maxResults: highMaxResults,
    });
    expect(results.length).toBe(absoluteMaxResults);
    // Expect 10 calls if MAX_RESULTS_PER_PAGE = 50 and ABSOLUTE_MAX_RESULTS = 500
    expect(mockSearchList).toHaveBeenCalledTimes(absoluteMaxResults / 50);
  });

  it("should throw an error if youtube.search.list fails", async () => {
    const query = "error test";
    const errorMessage = "API Error";
    mockSearchList.mockRejectedValueOnce(new Error(errorMessage));

    await expect(videoManagement.searchVideos({ query })).rejects.toThrow(
      `Failed to search videos: ${errorMessage}`
    );
  });

  // Test for 'order' parameter
  it("should call youtube.search.list with the specified order", async () => {
    const query = "order test";
    const order = "viewCount";
    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });

    await videoManagement.searchVideos({ query, order });

    expect(mockSearchList).toHaveBeenCalledWith(
      expect.objectContaining({
        order: order,
      })
    );
  });

  // Test for 'type' parameter
  it("should call youtube.search.list with the specified type", async () => {
    const query = "type test";
    const type = "channel";
    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });

    await videoManagement.searchVideos({ query, type });

    expect(mockSearchList).toHaveBeenCalledWith(
      expect.objectContaining({
        type: [type], // API expects an array for type
      })
    );
  });

  // Test for 'channelId' parameter
  it("should call youtube.search.list with the specified channelId", async () => {
    const query = "channelId test";
    const channelId = "UC12345";
    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });

    await videoManagement.searchVideos({ query, channelId });

    expect(mockSearchList).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: channelId,
      })
    );
  });

  // Test for 'videoDuration' parameter
  it("should call youtube.search.list with the specified videoDuration", async () => {
    const query = "videoDuration test";
    const videoDuration = "short"; // < 4 minutes
    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });

    await videoManagement.searchVideos({ query, videoDuration });

    expect(mockSearchList).toHaveBeenCalledWith(
      expect.objectContaining({
        videoDuration: videoDuration,
      })
    );
  });

  // Test for 'videoDuration' parameter being 'any'
  it("should not include videoDuration in API call if it's 'any'", async () => {
    const query = "videoDuration any test";
    const videoDuration = "any";
    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });

    await videoManagement.searchVideos({ query, videoDuration });

    const callArgs = mockSearchList.mock.calls[0][0];
    expect(callArgs.videoDuration).toBeUndefined();
  });

  // Test for 'publishedAfter' parameter (direct)
  it("should call youtube.search.list with the specified publishedAfter date", async () => {
    const query = "publishedAfter direct test";
    const publishedAfter = new Date().toISOString();
    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });

    await videoManagement.searchVideos({ query, publishedAfter });

    expect(mockSearchList).toHaveBeenCalledWith(
      expect.objectContaining({
        publishedAfter: publishedAfter,
      })
    );
  });

  // Test for 'regionCode' parameter
  it("should call youtube.search.list with the specified regionCode", async () => {
    const query = "regionCode test";
    const regionCode = "CA"; // Canada
    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });

    await videoManagement.searchVideos({ query, regionCode });

    expect(mockSearchList).toHaveBeenCalledWith(
      expect.objectContaining({
        regionCode: regionCode,
      })
    );
  });

  // Test that publishedAfter from recency takes precedence over direct publishedAfter if both provided
  // (though the current implementation logic seems to prioritize recency)
  it("should prioritize calculated publishedAfter from recency over direct publishedAfter", async () => {
    const query = "recency precedence test";
    const recency = "pastMonth";
    const directPublishedAfter = "2000-01-01T00:00:00.000Z"; // An old date
    const toleranceMilliseconds = 10000; // 10 seconds

    const calculatePublishedAfterSpy = jest.spyOn(
      VideoManagement.prototype as any,
      "calculatePublishedAfter"
    );

    // Calculate expected publishedAfter for 'pastMonth' just before the call
    const expectedTimeFromRecency = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    mockSearchList.mockResolvedValueOnce({ data: { items: [] } });
    await videoManagement.searchVideos({
      query,
      recency,
      publishedAfter: directPublishedAfter,
    });

    expect(calculatePublishedAfterSpy).toHaveBeenCalledWith(recency);
    const apiCallArgs = mockSearchList.mock.calls[0][0];

    expect(apiCallArgs.publishedAfter).toEqual(expect.any(String));
    expect(apiCallArgs.publishedAfter).not.toBe(directPublishedAfter);

    // Validate ISO string format (basic check)
    expect(apiCallArgs.publishedAfter).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );

    const actualPublishedAfterDate = new Date(apiCallArgs.publishedAfter);
    const timeDifference = Math.abs(
      actualPublishedAfterDate.getTime() - expectedTimeFromRecency.getTime()
    );

    expect(timeDifference).toBeLessThanOrEqual(toleranceMilliseconds);
    expect(actualPublishedAfterDate.getTime()).toBeGreaterThan(
      new Date(directPublishedAfter).getTime()
    );

    calculatePublishedAfterSpy.mockRestore();
  });
});
