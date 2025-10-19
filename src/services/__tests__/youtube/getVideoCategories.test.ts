import { YoutubeService } from "../../youtube.service";
import { google } from "googleapis";
import { CacheService } from "../../cache.service";

// Mock the googleapis library
jest.mock("googleapis", () => ({
  google: {
    youtube: jest.fn(() => ({
      videoCategories: {
        list: jest.fn(),
      },
    })),
  },
}));

// Mock CacheService at the module level
jest.mock("../../cache.service", () => {
  return {
    CacheService: jest.fn().mockImplementation(() => {
      return {
        getOrSet: jest.fn((key, operation, _ttl, _collection) => operation()),
        createOperationKey: jest.fn(),
      };
    }),
  };
});

describe("YoutubeService.getVideoCategories", () => {
  let videoManagement: YoutubeService;
  let mockYoutubeVideoCategoriesList: jest.Mock;
  let mockCacheServiceInstance: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Reset the mock before each test
    mockYoutubeVideoCategoriesList = jest.fn();
    (google.youtube as jest.Mock).mockReturnValue({
      videoCategories: {
        list: mockYoutubeVideoCategoriesList,
      },
    });

    mockCacheServiceInstance = new CacheService({} as any);

    videoManagement = new YoutubeService(
      "test_api_key",
      mockCacheServiceInstance
    );
    // Ensure process.env.YOUTUBE_API_KEY is mocked or set if your VideoManagement constructor relies on it directly.
    // For instance: process.env.YOUTUBE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    jest.clearAllMocks();
    // delete process.env.YOUTUBE_API_KEY; // Clean up env var if set
  });

  it("should retrieve video categories successfully for a given region code", async () => {
    const mockRegionCode = "GB";
    const mockCategoriesResponse = {
      data: {
        items: [
          { id: "1", snippet: { title: "Film & Animation" } },
          { id: "2", snippet: { title: "Autos & Vehicles" } },
        ],
      },
    };
    mockYoutubeVideoCategoriesList.mockResolvedValue(mockCategoriesResponse);

    const categories = await videoManagement.getVideoCategories(mockRegionCode);

    expect(categories).toEqual([
      { id: "1", title: "Film & Animation" },
      { id: "2", title: "Autos & Vehicles" },
    ]);
    expect(mockYoutubeVideoCategoriesList).toHaveBeenCalledWith({
      part: ["snippet"],
      regionCode: mockRegionCode,
    });
  });

  it('should use default region code "US" when none is provided', async () => {
    const mockCategoriesResponse = {
      data: {
        items: [{ id: "10", snippet: { title: "Music" } }],
      },
    };
    mockYoutubeVideoCategoriesList.mockResolvedValue(mockCategoriesResponse);

    await videoManagement.getVideoCategories();

    expect(mockYoutubeVideoCategoriesList).toHaveBeenCalledWith({
      part: ["snippet"],
      regionCode: "US", // Default region code
    });
  });

  it("should return an empty array when no categories are found", async () => {
    const mockEmptyResponse = {
      data: { items: [] },
    };
    mockYoutubeVideoCategoriesList.mockResolvedValue(mockEmptyResponse);

    const categories = await videoManagement.getVideoCategories("FR");

    expect(categories).toEqual([]);
    expect(mockYoutubeVideoCategoriesList).toHaveBeenCalledWith({
      part: ["snippet"],
      regionCode: "FR",
    });
  });

  it("should return an empty array when API response has no items property", async () => {
    const mockMalformedResponse = {
      data: {}, // No items property
    };
    mockYoutubeVideoCategoriesList.mockResolvedValue(mockMalformedResponse);

    const categories = await videoManagement.getVideoCategories("DE");
    expect(categories).toEqual([]);
  });

  it("should throw an error if the YouTube API call fails", async () => {
    const errorMessage = "API Error";
    mockYoutubeVideoCategoriesList.mockRejectedValue(new Error(errorMessage));

    await expect(videoManagement.getVideoCategories("CA")).rejects.toThrow(
      `YouTube API call for getVideoCategories failed for regionCode: CA`
    );
  });
});
