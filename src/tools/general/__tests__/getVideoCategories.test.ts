import { getVideoCategoriesHandler } from '../getVideoCategories';
import { youtube } from '@googleapis/youtube';
import { VideoManagement } from '../../../functions/videos';

jest.mock('@googleapis/youtube');
jest.mock('../../../functions/videos'); // Mock VideoManagement

describe('getVideoCategoriesHandler', () => {
  let mockVideoManager: jest.Mocked<VideoManagement>;

  beforeEach(() => {
    // Create a new mock instance for each test
    mockVideoManager = new VideoManagement({} as any) as jest.Mocked<VideoManagement>;

    // Mock the specific method used by the handler
    mockVideoManager.getVideoCategories = jest.fn();

    // Reset youtube mock specifically for videoCategories.list
    (youtube as any).videoCategories = {
      list: jest.fn(),
    };
  });

  it('should return a list of video categories', async () => {
    // Configure VideoManagement mock
    (mockVideoManager.getVideoCategories as jest.Mock).mockResolvedValue([
      { id: '1', title: 'Film & Animation' },
      { id: '2', title: 'Autos & Vehicles' },
    ]);

    const params = { regionCode: 'US' };
    const result = await getVideoCategoriesHandler(params, mockVideoManager);

    expect(mockVideoManager.getVideoCategories).toHaveBeenCalledWith('US');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        { id: '1', title: 'Film & Animation' },
        { id: '2', title: 'Autos & Vehicles' },
      ]);
    }
  });

  it('should handle errors when fetching categories', async () => {
    // Configure VideoManagement mock to throw an error
    (mockVideoManager.getVideoCategories as jest.Mock).mockRejectedValue(new Error('API Error'));

    const params = { regionCode: 'US' };
    const result = await getVideoCategoriesHandler(params, mockVideoManager);

    expect(mockVideoManager.getVideoCategories).toHaveBeenCalledWith('US');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('API Error');
    }
  });

  it('should use default regionCode "US" if not provided', async () => {
    (mockVideoManager.getVideoCategories as jest.Mock).mockResolvedValue([
      { id: '10', title: 'Music' },
    ]);

    const params = {}; // No regionCode provided
    await getVideoCategoriesHandler(params, mockVideoManager);

    // The handler itself applies the default, so getVideoCategories (from VideoManager) should be called with 'US'
    expect(mockVideoManager.getVideoCategories).toHaveBeenCalledWith('US');
  });
});
