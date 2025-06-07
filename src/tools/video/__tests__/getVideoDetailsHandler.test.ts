import { getVideoDetailsHandler } from '../getVideoDetails'; // Adjust path as needed
import { VideoManagement } from '../../../functions/videos'; // Adjust path as needed
// parseYouTubeNumber is used by the handler, not directly in tests usually
// import { parseYouTubeNumber } from '../../../utils/numberParser';
import { calculateLikeToViewRatio, calculateCommentToViewRatio } from '../../../utils/engagementCalculator'; // Adjust path as needed
import { youtube_v3 } from 'googleapis';
import { LeanVideoDetails } from '../../../types/youtube'; // Adjust path as needed
// CallToolResult might be unused if we use `as any` or a specific type for the formatter's output
// import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Mock VideoManagement class
jest.mock('../../../functions/videos');

// Mock utility functions if they are complex or have external dependencies not easily mocked.
// For this example, we'll use the actual implementations of parseYouTubeNumber and engagementCalculators
// as they are simple, pure functions. If they were more complex, mocking them would be advisable.
// jest.mock('../../../utils/numberParser');
// jest.mock('../../../utils/engagementCalculator');


describe('getVideoDetailsHandler - Transformation Logic', () => {
  let mockVideoManager: jest.Mocked<VideoManagement>;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Create a new mock instance for VideoManagement before each test
    mockVideoManager = new VideoManagement() as jest.Mocked<VideoManagement>;

    // Mock the getVideo method specifically for this test suite
    // It's important to mock the methods of the instance, not the class prototype, if using instance mocks
    mockVideoManager.getVideo = jest.fn();
  });

  afterEach(() => {
    mockConsoleError.mockRestore();
    jest.clearAllMocks();
  });

  // Test cases will be added in the next step.
  // Example of a mock API response structure:
  const mockFullVideoDetails: youtube_v3.Schema$Video = {
    id: 'testVideoId1',
    snippet: {
      title: 'Test Video Title 1',
      description: 'This is a test description that is definitely longer than one hundred characters to check truncation.',
      channelId: 'testChannelId1',
      channelTitle: 'Test Channel Title 1',
      publishedAt: '2023-01-01T00:00:00Z',
      tags: ['tag1', 'tag2'],
      categoryId: '10',
      defaultLanguage: 'en',
    },
    contentDetails: {
      duration: 'PT1M30S', // Example: 1 minute 30 seconds
    },
    statistics: {
      viewCount: '1000',
      likeCount: '100',
      commentCount: '10',
    },
  };

  const mockVideoId1 = 'testVideoId1';
  const mockVideoId2 = 'testVideoId2Error';
  const mockVideoId3 = 'testVideoId3MissingFields';

  const longDescriptionFor1000 = 'Str'.repeat(350); // 3 * 350 = 1050 characters

  // Re-using and extending the mockFullVideoDetails from the boilerplate
  const mockFullVideoDetails1: youtube_v3.Schema$Video = {
    id: mockVideoId1,
    snippet: {
      title: 'Test Video Title 1',
      description: longDescriptionFor1000,
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
  };

  const mockFullVideoDetails3MissingFields: youtube_v3.Schema$Video = {
    id: mockVideoId3,
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
    // statistics is missing
  };

  it('should correctly transform a single video successfully', async () => {
    mockVideoManager.getVideo.mockResolvedValue(mockFullVideoDetails1);

    const params = { videoIds: [mockVideoId1] };
    // Use `as any` for now, or define a specific type for the { content: [...] } structure
    const result = await getVideoDetailsHandler(params, mockVideoManager) as any;

    expect(mockVideoManager.getVideo).toHaveBeenCalledWith({
      videoId: mockVideoId1,
      parts: ["snippet", "statistics", "contentDetails"],
    });

    const expectedDetails: LeanVideoDetails = {
      id: mockVideoId1,
      title: 'Test Video Title 1',
      description: longDescriptionFor1000.substring(0,1000) + "...",
      channelId: 'testChannelId1',
      channelTitle: 'Test Channel Title 1',
      publishedAt: '2023-01-01T00:00:00Z',
      duration: 'PT1M30S',
      viewCount: 1000,
      likeCount: 100,
      commentCount: 10,
      likeToViewRatio: calculateLikeToViewRatio(1000, 100), // Using actual calculator for expectation
      commentToViewRatio: calculateCommentToViewRatio(1000, 10), // Using actual calculator
      tags: ['tag1', 'tag2'],
      categoryId: '10',
      defaultLanguage: 'en',
    };

    const expectedResult = {
        content: [{
            type: "text",
            text: JSON.stringify({ [mockVideoId1]: expectedDetails }, null, 2)
        }]
    };
    expect(result).toEqual(expectedResult);
  });

  it('should handle errors gracefully and log them when a video is not found', async () => {
    mockVideoManager.getVideo
      .mockResolvedValueOnce(mockFullVideoDetails1) // For mockVideoId1
      .mockRejectedValueOnce(new Error('Video not found for ID: ' + mockVideoId2)); // For mockVideoId2

    const params = { videoIds: [mockVideoId1, mockVideoId2] };
    const result = await getVideoDetailsHandler(params, mockVideoManager) as any;

    expect(mockVideoManager.getVideo).toHaveBeenCalledWith({ videoId: mockVideoId1, parts: ["snippet", "statistics", "contentDetails"] });
    expect(mockVideoManager.getVideo).toHaveBeenCalledWith({ videoId: mockVideoId2, parts: ["snippet", "statistics", "contentDetails"] });

    const expectedDetailsForVideo1: LeanVideoDetails = {
      id: mockVideoId1,
      title: 'Test Video Title 1',
      description: longDescriptionFor1000.substring(0,1000) + "...",
      channelId: 'testChannelId1',
      channelTitle: 'Test Channel Title 1',
      publishedAt: '2023-01-01T00:00:00Z',
      duration: 'PT1M30S',
      viewCount: 1000,
      likeCount: 100,
      commentCount: 10,
      likeToViewRatio: calculateLikeToViewRatio(1000, 100),
      commentToViewRatio: calculateCommentToViewRatio(1000, 10),
      tags: ['tag1', 'tag2'],
      categoryId: '10',
      defaultLanguage: 'en',
    };

    const expectedResult = {
        content: [{
            type: "text",
            text: JSON.stringify({ [mockVideoId1]: expectedDetailsForVideo1, [mockVideoId2]: null }, null, 2)
        }]
    };
    expect(result).toEqual(expectedResult);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('Video details not found for ID: testVideoId2Error', 'Video not found for ID: testVideoId2Error');
  });

  it('should handle missing optional fields gracefully', async () => {
    mockVideoManager.getVideo.mockResolvedValue(mockFullVideoDetails3MissingFields);

    const params = { videoIds: [mockVideoId3] };
    const result = await getVideoDetailsHandler(params, mockVideoManager) as any;

    expect(mockVideoManager.getVideo).toHaveBeenCalledWith({
      videoId: mockVideoId3,
      parts: ["snippet", "statistics", "contentDetails"],
    });

    const expectedDetailsMissing: LeanVideoDetails = {
      id: mockVideoId3,
      title: 'Test Video Title 3 Missing',
      description: null,
      channelId: 'testChannelId3',
      channelTitle: 'Test Channel Title 3',
      publishedAt: '2023-01-03T00:00:00Z',
      duration: null,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      likeToViewRatio: calculateLikeToViewRatio(0, 0),
      commentToViewRatio: calculateCommentToViewRatio(0, 0),
      tags: [],
      categoryId: null,
      defaultLanguage: null,
    };

    const expectedResult = {
        content: [{
            type: "text",
            text: JSON.stringify({ [mockVideoId3]: expectedDetailsMissing }, null, 2)
        }]
    };
    expect(result).toEqual(expectedResult);
  });

  it('should use parseYouTubeNumber for numeric fields and engagementCalculator for ratios', async () => {

    const specificStatsVideo: youtube_v3.Schema$Video = {
        ...mockFullVideoDetails1,
        id: 'specificStatsVideo',
        statistics: { // Ensure statistics are part of the cloned object or set here
            viewCount: '5555',
            likeCount: '555',
            commentCount: '55'
        },
        snippet: { // Ensure snippet is part of the cloned object
            ...mockFullVideoDetails1.snippet,
            title: "Specific Stats Video Title" // Example, ensure all required fields are present
        },
        contentDetails: { // Ensure contentDetails is part of the cloned object
            ...mockFullVideoDetails1.contentDetails
        }
    };
    mockVideoManager.getVideo.mockResolvedValue(specificStatsVideo);

    const params = { videoIds: ['specificStatsVideo'] };
    const result = await getVideoDetailsHandler(params, mockVideoManager) as any;
    const parsedResultData = JSON.parse(result.content[0].text);
    const videoResult = parsedResultData['specificStatsVideo'];

    expect(videoResult.viewCount).toBe(5555);
    expect(videoResult.likeCount).toBe(555);
    expect(videoResult.commentCount).toBe(55);
    expect(videoResult.likeToViewRatio).toBe(calculateLikeToViewRatio(5555, 555));
    expect(videoResult.commentToViewRatio).toBe(calculateCommentToViewRatio(5555, 55));
  });

  it('should correctly truncate description longer than 1000 characters', async () => {
    const veryLongDesc = 'Blah '.repeat(300); // 5 * 300 = 1500 chars
    const videoWithVeryLongDesc: youtube_v3.Schema$Video = {
      ...mockFullVideoDetails1,
      id: 'veryLongDescVideo',
      snippet: {
        ...mockFullVideoDetails1.snippet,
        description: veryLongDesc,
      },
    };
    mockVideoManager.getVideo.mockResolvedValue(videoWithVeryLongDesc);

    const params = { videoIds: ['veryLongDescVideo'] };
    const result = await getVideoDetailsHandler(params, mockVideoManager) as any;
    const parsedResultData = JSON.parse(result.content[0].text);
    const videoResult = parsedResultData['veryLongDescVideo'];

    expect(videoResult.description).toBe(veryLongDesc.substring(0, 1000) + "...");
    expect(videoResult.description?.length).toBe(1003);
  });

  it('should not truncate description if it is 1000 characters or less', async () => {
    const exactLengthDescription = 'a'.repeat(1000);
    const videoWithExactLengthDesc: youtube_v3.Schema$Video = {
      ...mockFullVideoDetails1,
      id: 'exactLengthVideo',
      snippet: { ...mockFullVideoDetails1.snippet, description: exactLengthDescription },
    };
    mockVideoManager.getVideo.mockResolvedValueOnce(videoWithExactLengthDesc);
    let params = { videoIds: ['exactLengthVideo'] };
    let result = await getVideoDetailsHandler(params, mockVideoManager) as any;
    let parsedResultData = JSON.parse(result.content[0].text);
    let videoResult = parsedResultData['exactLengthVideo'];
    expect(videoResult.description).toBe(exactLengthDescription);

    const shorterDescription = 'b'.repeat(500);
    const videoWithShorterDesc: youtube_v3.Schema$Video = {
      ...mockFullVideoDetails1,
      id: 'shorterDescVideo',
      snippet: { ...mockFullVideoDetails1.snippet, description: shorterDescription },
    };
    mockVideoManager.getVideo.mockResolvedValueOnce(videoWithShorterDesc);
    params = { videoIds: ['shorterDescVideo'] };
    result = await getVideoDetailsHandler(params, mockVideoManager) as any;
    parsedResultData = JSON.parse(result.content[0].text);
    videoResult = parsedResultData['shorterDescVideo'];
    expect(videoResult.description).toBe(shorterDescription);
  });

  it('should return null description if original description is null or undefined', async () => {
    const videoWithNullDesc: youtube_v3.Schema$Video = {
      ...mockFullVideoDetails1,
      id: 'nullDescVideo',
      snippet: {
        ...mockFullVideoDetails1.snippet,
        description: null,
      },
    };
    mockVideoManager.getVideo.mockResolvedValueOnce(videoWithNullDesc);

    let params = { videoIds: ['nullDescVideo'] };
    let result = await getVideoDetailsHandler(params, mockVideoManager) as any;
    let parsedResultData = JSON.parse(result.content[0].text);
    let videoResult = parsedResultData['nullDescVideo'];
    expect(videoResult.description).toBeNull();

    const videoWithUndefinedDesc: youtube_v3.Schema$Video = {
      ...mockFullVideoDetails1,
      id: 'undefinedDescVideo',
      snippet: {
        ...mockFullVideoDetails1.snippet,
        description: undefined,
      },
    };
    mockVideoManager.getVideo.mockResolvedValueOnce(videoWithUndefinedDesc);

    params = { videoIds: ['undefinedDescVideo'] };
    result = await getVideoDetailsHandler(params, mockVideoManager) as any;
    parsedResultData = JSON.parse(result.content[0].text);
    videoResult = parsedResultData['undefinedDescVideo'];
    expect(videoResult.description).toBeNull();
  });

});
