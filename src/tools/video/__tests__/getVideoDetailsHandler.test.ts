import { getVideoDetailsHandler } from '../getVideoDetails';
import { VideoManagement } from '../../../functions/videos';
import { calculateLikeToViewRatio, calculateCommentToViewRatio } from "../../../utils/engagementCalculator";
import { parseYouTubeNumber } from "../../../utils/numberParser";

jest.mock('../../../functions/videos');
jest.mock('../../../utils/engagementCalculator', () => ({
  calculateLikeToViewRatio: jest.fn(),
  calculateCommentToViewRatio: jest.fn(),
}));
jest.mock('../../../utils/numberParser');


describe('getVideoDetailsHandler', () => {
  let mockVideoManager: jest.Mocked<VideoManagement>;

  beforeEach(() => {
    mockVideoManager = new VideoManagement({} as any) as jest.Mocked<VideoManagement>;

    // Mock specific methods
    mockVideoManager.getVideo = jest.fn(); // Changed from getVideoDetails to getVideo

    // Reset mocks for imported functions
    (calculateLikeToViewRatio as jest.Mock).mockReset();
    (calculateCommentToViewRatio as jest.Mock).mockReset();
    (parseYouTubeNumber as jest.Mock).mockReset();

    (parseYouTubeNumber as jest.Mock).mockImplementation(val => Number(val) || 0);
    // Corrected parameter order to match actual function: (viewCount, likeCount)
    (calculateLikeToViewRatio as jest.Mock).mockImplementation((viewCount, likeCount) => (Number(viewCount) > 0 ? Number(likeCount) / Number(viewCount) : 0));
    // Corrected parameter order to match actual function: (viewCount, commentCount)
    (calculateCommentToViewRatio as jest.Mock).mockImplementation((viewCount, commentCount) => (Number(viewCount) > 0 ? Number(commentCount) / Number(viewCount) : 0));

    // Spy on console.error and mock its implementation
    jest.spyOn(console, 'error').mockImplementation(() => {});
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
      id: 'testVideoId1',
      snippet: {
        title: 'Test Video Title 1',
        description: veryLongDesc, // Use a very long description
        channelId: 'testChannelId1',
        channelTitle: 'Test Channel Title 1',
        publishedAt: '2023-01-01T00:00:00Z',
        tags: ['tag1', 'tag2'],
        categoryId: '10',
        defaultLanguage: 'en',
      },
      contentDetails: {
        duration: 'PT1M30S',
      },
      statistics: {
        viewCount: '1000',
        likeCount: '100',
        commentCount: '10',
      },
    },
    testVideoId2Error: null, // To simulate an error for one video
    testVideoId3MissingFields: {
      id: 'testVideoId3MissingFields',
      snippet: {
        title: 'Test Video Title 3 Missing',
        // description is missing
        channelId: 'testChannelId3',
        channelTitle: 'Test Channel Title 3',
        publishedAt: '2023-01-03T00:00:00Z',
        // tags are missing
        // categoryId is missing
        // defaultLanguage is missing
      },
      // contentDetails is missing
      statistics: {
        // viewCount is missing
        // likeCount is missing
        // commentCount is missing
      },
    },
    specificStatsVideo: {
      id: 'specificStatsVideo',
      snippet: { title: 'Stats Test', channelId: 'chStat', channelTitle: 'Stat Ch', publishedAt: '2023-01-04T00:00:00Z' },
      statistics: { viewCount: '5555', likeCount: '55', commentCount: '5' }
    },
    veryLongDescVideo: {
      id: 'veryLongDescVideo',
      snippet: { title: 'Long Desc Test', description: veryLongDesc, channelId: 'chDesc', channelTitle: 'Desc Ch', publishedAt: '2023-01-05T00:00:00Z' },
      statistics: { viewCount: '100' }
    },
    exactLengthVideo: {
      id: 'exactLengthVideo',
      snippet: { title: 'Exact Length Desc Test', description: exactLengthDescription, channelId: 'chDesc', channelTitle: 'Desc Ch', publishedAt: '2023-01-06T00:00:00Z' },
      statistics: { viewCount: '100' }
    },
    shortDescVideo: {
      id: 'shortDescVideo',
      snippet: { title: 'Short Desc Test', description: "Short and sweet.", channelId: 'chDesc', channelTitle: 'Desc Ch', publishedAt: '2023-01-07T00:00:00Z' },
      statistics: { viewCount: '100' }
    },
    nullDescVideo: {
        id: 'nullDescVideo',
        snippet: { title: 'Null Desc Test', description: null, channelId: 'chDesc', channelTitle: 'Desc Ch', publishedAt: '2023-01-08T00:00:00Z' },
        statistics: { viewCount: '100' }
    },
    undefinedDescVideo: {
        id: 'undefinedDescVideo',
        snippet: { title: 'Undefined Desc Test', description: undefined, channelId: 'chDesc', channelTitle: 'Desc Ch', publishedAt: '2023-01-09T00:00:00Z' },
        statistics: { viewCount: '100' }
    }
  };


  describe('getVideoDetailsHandler - Transformation Logic', () => {
    beforeEach(() => {
      // Mock videoManager.getVideo to return the corresponding entry from mockVideoDetailsData
      mockVideoManager.getVideo.mockImplementation(async (params: { videoId: string }) => {
        return mockVideoDetailsData[params.videoId] || null;
      });

      // Default mock implementations for ratio functions were here, removing them
      // so the top-level mockImplementation is used by default.
      // Tests needing specific values should set them explicitly.
    });

    it('should correctly transform a single video successfully', async () => {
      // Set specific values if this test relies on them, otherwise ensure
      // the default mockImplementation provides suitable values.
      (calculateLikeToViewRatio as jest.Mock).mockReturnValue(0.1);
      (calculateCommentToViewRatio as jest.Mock).mockReturnValue(0.01);

      const params = { videoIds: ['testVideoId1'] };
      const result = await getVideoDetailsHandler(params, mockVideoManager) as any;

      expect(result.success).toBe(true);
      const expectedTransformedVideo = {
        testVideoId1: {
          id: 'testVideoId1',
          title: 'Test Video Title 1',
          description: veryLongDesc.substring(0,1000) + "...",
          channelId: 'testChannelId1',
          channelTitle: 'Test Channel Title 1',
          publishedAt: '2023-01-01T00:00:00Z',
          duration: 'PT1M30S',
          viewCount: 1000,
          likeCount: 100,
          commentCount: 10,
          likeToViewRatio: 0.1,
          commentToViewRatio: 0.01,
          tags: ['tag1', 'tag2'],
          categoryId: '10',
          defaultLanguage: 'en',
        }
      };
      expect(result.data).toEqual(expectedTransformedVideo);
    });

    it('should handle errors gracefully and log them when a video is not found', async () => {
      const params = { videoIds: ['testVideoId1', 'testVideoId2Error'] };
      const result = await getVideoDetailsHandler(params, mockVideoManager) as any;

      expect(result.success).toBe(true); // The overall operation is a success
      const expectedData = {
        testVideoId1: {
            id: 'testVideoId1',
            title: 'Test Video Title 1',
            description: veryLongDesc.substring(0,1000) + "...",
            channelId: 'testChannelId1',
            channelTitle: 'Test Channel Title 1',
            publishedAt: '2023-01-01T00:00:00Z',
            duration: 'PT1M30S',
            viewCount: 1000,
            likeCount: 100,
            commentCount: 10,
            likeToViewRatio: 0.1,
            commentToViewRatio: 0.01,
            tags: ['tag1', 'tag2'],
            categoryId: '10',
            defaultLanguage: 'en',
        },
        testVideoId2Error: null,
      };
      expect(result.data).toEqual(expectedData);
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith('Video details not found for ID: testVideoId2Error', 'Returned null from videoManager.getVideo');
    });

    it('should handle missing optional fields gracefully', async () => {
      // Ensure the correct calculation to 0 for zero inputs
      (calculateLikeToViewRatio as jest.Mock).mockImplementation((l, v) => v > 0 ? Number(l)/Number(v) : 0);
      (calculateCommentToViewRatio as jest.Mock).mockImplementation((c, v) => v > 0 ? Number(c)/Number(v) : 0);

      const params = { videoIds: ['testVideoId3MissingFields'] };
      const result = await getVideoDetailsHandler(params, mockVideoManager) as any;

      expect(result.success).toBe(true);
      const expectedTransformedVideo = {
        testVideoId3MissingFields: {
          id: 'testVideoId3MissingFields',
          title: 'Test Video Title 3 Missing',
          description: null,
          channelId: 'testChannelId3',
          channelTitle: 'Test Channel Title 3',
          publishedAt: '2023-01-03T00:00:00Z',
          duration: null,
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          likeToViewRatio: 0,
          commentToViewRatio: 0,
          tags: [],
          categoryId: null,
          defaultLanguage: null,
        }
      };
      expect(result.data).toEqual(expectedTransformedVideo);
    });

    it('should use parseYouTubeNumber for numeric fields and engagementCalculator for ratios', async () => {
      (parseYouTubeNumber as jest.Mock).mockImplementation(val => Number(val) * 2);
      // Specific mocks for this test
      (calculateLikeToViewRatio as jest.Mock).mockReturnValue(0.55);
      (calculateCommentToViewRatio as jest.Mock).mockReturnValue(0.055);

      const params = { videoIds: ['specificStatsVideo'] };
      const result = await getVideoDetailsHandler(params, mockVideoManager) as any;
      const videoResult = result.data['specificStatsVideo'];

      expect(videoResult.viewCount).toBe(11110);
      expect(videoResult.likeCount).toBe(110);
      expect(videoResult.commentCount).toBe(10);
      expect(videoResult.likeToViewRatio).toBe(0.55);
      expect(videoResult.commentToViewRatio).toBe(0.055);

      expect(parseYouTubeNumber).toHaveBeenCalledWith('5555');
      expect(parseYouTubeNumber).toHaveBeenCalledWith('55');
      expect(parseYouTubeNumber).toHaveBeenCalledWith('5');
      // Actual call: calculateLikeToViewRatio(viewCount, likeCount)
      expect(calculateLikeToViewRatio).toHaveBeenCalledWith(11110, 110);
      // Actual call: calculateCommentToViewRatio(viewCount, commentCount)
      expect(calculateCommentToViewRatio).toHaveBeenCalledWith(11110, 10);
    });

    it('should correctly truncate description longer than 1000 characters', async () => {
      (calculateLikeToViewRatio as jest.Mock).mockReturnValue(0); // Default, not relevant for this test
      (calculateCommentToViewRatio as jest.Mock).mockReturnValue(0); // Default, not relevant for this test
        const params = { videoIds: ['veryLongDescVideo'] };
        const result = await getVideoDetailsHandler(params, mockVideoManager) as any;
        const videoResult = result.data['veryLongDescVideo'];
        expect(videoResult.description.length).toBe(1000 + 3); // 1000 chars + "..."
        expect(videoResult.description.endsWith("...")).toBe(true);
        expect(videoResult.description).toBe(veryLongDesc.substring(0, 1000) + "...");
    });

    it('should not truncate description if it is 1000 characters or less', async () => {
        let params = { videoIds: ['exactLengthVideo'] };
        let result = await getVideoDetailsHandler(params, mockVideoManager) as any;
        let videoResult = result.data['exactLengthVideo'];
        expect(videoResult.description).toBe(exactLengthDescription);

        params = { videoIds: ['shortDescVideo'] };
        result = await getVideoDetailsHandler(params, mockVideoManager) as any;
        videoResult = result.data['shortDescVideo'];
        expect(videoResult.description).toBe("Short and sweet.");
    });

    it('should return null description if original description is null or undefined', async () => {
        let params = { videoIds: ['nullDescVideo'] };
        let result = await getVideoDetailsHandler(params, mockVideoManager) as any;
        let videoResult = result.data['nullDescVideo'];
        expect(videoResult.description).toBeNull();

        params = { videoIds: ['undefinedDescVideo'] };
        result = await getVideoDetailsHandler(params, mockVideoManager) as any;
        videoResult = result.data['undefinedDescVideo'];
        expect(videoResult.description).toBeNull();
    });

  });
});
