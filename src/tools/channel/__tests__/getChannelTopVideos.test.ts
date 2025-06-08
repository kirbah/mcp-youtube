/* eslint-env node */
/* eslint-parser-options project: ["./tsconfig.test.json"] */
import { getChannelTopVideosHandler } from '../getChannelTopVideos';
import { formatSuccess } from '../../../utils/responseFormatter';
import { formatError } from '../../../utils/errorHandler';
import type { VideoManagement } from '../../../functions/videos';

// Mock utility functions
jest.mock('../../../utils/responseFormatter', () => ({
  formatSuccess: jest.fn((data) => ({ statusCode: 200, body: JSON.stringify(data) })),
}));
jest.mock('../../../utils/errorHandler', () => ({
  formatError: jest.fn((error) => {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    let statusCode = 500;
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      statusCode = 400;
    }
    return { statusCode, body: JSON.stringify({ message }) };
  }),
}));

// Mock VideoManagement
jest.mock('../../../functions/videos', () => ({
  VideoManagement: jest.fn().mockImplementation(() => ({
    getChannelTopVideos: jest.fn(),
    getChannelStatistics: jest.fn(),
    getVideo: jest.fn(),
    searchVideos: jest.fn(),
    getTranscript: jest.fn(),
    getTrendingVideos: jest.fn(),
    getVideoCategories: jest.fn(),
  })),
}));

describe('getChannelTopVideosHandler', () => {
  let mockVideoManager: jest.Mocked<VideoManagement>;

  beforeEach(() => {
     mockVideoManager = {
      getChannelTopVideos: jest.fn(),
      getChannelStatistics: jest.fn(),
      getVideo: jest.fn(),
      searchVideos: jest.fn(),
      getTranscript: jest.fn(),
      getTrendingVideos: jest.fn(),
      getVideoCategories: jest.fn(),
    } as jest.Mocked<VideoManagement>;

    (formatSuccess as jest.Mock).mockClear();
    (formatError as jest.Mock).mockClear();
  });

  it('should return top videos for a valid channelId and maxResults', async () => {
    const mockTopVideosResult = [
      { videoId: 'vid1', title: 'Top Video 1', viewCount: 1000 },
      { videoId: 'vid2', title: 'Top Video 2', viewCount: 900 },
    ];
    mockVideoManager.getChannelTopVideos.mockResolvedValue(mockTopVideosResult);

    const params = { channelId: 'UC123', maxResults: 2 };
    const result = await getChannelTopVideosHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelTopVideos).toHaveBeenCalledWith({
      channelId: 'UC123',
      maxResults: 2,
    });
    expect(formatSuccess).toHaveBeenCalledWith(mockTopVideosResult);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(mockTopVideosResult);
  });

  it('should use default maxResults when not provided', async () => {
    const mockTopVideosResult = [
      { videoId: 'vid1', title: 'Top Video 1', viewCount: 1000 },
    ];
    mockVideoManager.getChannelTopVideos.mockResolvedValue(mockTopVideosResult);

    const params = { channelId: 'UC123' }; // maxResults is not provided
    await getChannelTopVideosHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelTopVideos).toHaveBeenCalledWith({
      channelId: 'UC123',
      maxResults: 10, // Default value
    });
    expect(formatSuccess).toHaveBeenCalledWith(mockTopVideosResult);
  });

  it('should return a 400 error for an invalid channelId (empty string)', async () => {
    const params = { channelId: '', maxResults: 5 };
    const result = await getChannelTopVideosHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelTopVideos).not.toHaveBeenCalled();
    expect(formatError).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZodError' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBeDefined();
  });

  it('should return a 400 error if maxResults is less than 1', async () => {
    const params = { channelId: 'UC123', maxResults: 0 };
    const result = await getChannelTopVideosHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelTopVideos).not.toHaveBeenCalled();
    expect(formatError).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZodError' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBeDefined();
  });

  it('should return a 400 error if maxResults is greater than 500', async () => {
    const params = { channelId: 'UC123', maxResults: 501 };
    const result = await getChannelTopVideosHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelTopVideos).not.toHaveBeenCalled();
    expect(formatError).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZodError' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBeDefined();
  });

  it('should return a 500 error if videoManager.getChannelTopVideos throws an error', async () => {
    const errorMessage = 'API Error';
    mockVideoManager.getChannelTopVideos.mockRejectedValue(new Error(errorMessage));

    const params = { channelId: 'UC123', maxResults: 5 };
    const result = await getChannelTopVideosHandler(params, mockVideoManager);

    expect(mockVideoManager.getChannelTopVideos).toHaveBeenCalledWith({
      channelId: 'UC123',
      maxResults: 5,
    });
    expect(formatError).toHaveBeenCalledWith(new Error(errorMessage));
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).message).toBe(errorMessage);
  });
});
