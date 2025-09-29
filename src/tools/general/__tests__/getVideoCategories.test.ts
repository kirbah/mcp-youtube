import { getVideoCategoriesHandler } from "../getVideoCategories";
// import { youtube } from '@googleapis/youtube'; // Removed
import { YoutubeService } from "../../../services/youtube.service";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types";

jest.mock("googleapis", () => {
  const mockVideoCategoriesList = jest.fn();
  return {
    google: {
      youtube: jest.fn(() => ({
        videoCategories: {
          list: mockVideoCategoriesList,
        },
      })),
    },
    // expose the mock itself to be reset/configured in tests
    mockVideoCategoriesList_DO_NOT_USE_DIRECTLY: mockVideoCategoriesList,
  };
});
jest.mock("../../../services/youtube.service"); // Mock YoutubeService

// Helper to access the deeply nested mock
const getMockVideoCategoriesList = () => {
  const mockedGoogleapis = jest.requireMock("googleapis");
  // google.youtube() returns the object with videoCategories.list
  // So we need to get the mock from the result of the call to youtube()
  // This is a bit tricky because google.youtube is also a mock.
  // Let's access the one set up for the test.
  return mockedGoogleapis.google.youtube().videoCategories.list;
};

describe("getVideoCategoriesHandler", () => {
  let mockVideoManager: jest.Mocked<YoutubeService>;
  let mockVideoCategoriesList: jest.Mock;

  beforeEach(() => {
    mockVideoManager = new YoutubeService();
    mockVideoManager.getVideoCategories = jest.fn(); // This is the method from VideoManagement

    // Reset the list mock for each test
    mockVideoCategoriesList = getMockVideoCategoriesList();
    mockVideoCategoriesList.mockReset();
  });

  it("should return a list of video categories", async () => {
    const mockApiResponse = {
      data: {
        items: [
          { id: "1", snippet: { title: "Film & Animation" } },
          { id: "2", snippet: { title: "Autos & Vehicles" } },
        ],
      },
    };
    mockVideoCategoriesList.mockResolvedValue(mockApiResponse);

    // This is what VideoManagement's method should return after processing API response
    const expectedCategoriesFromVideoManager = [
      { id: "1", title: "Film & Animation" },
      { id: "2", title: "Autos & Vehicles" },
    ];
    (mockVideoManager.getVideoCategories as jest.Mock).mockResolvedValue(
      expectedCategoriesFromVideoManager
    );

    const params = { regionCode: "US" };
    const result = await getVideoCategoriesHandler(params, mockVideoManager);

    expect(mockVideoManager.getVideoCategories).toHaveBeenCalledWith("US");
    expect(result.success).toBe(true);
    if (result.success && result.content) {
      const returnedData = JSON.parse(result.content[0].text as string);
      expect(returnedData).toEqual(expectedCategoriesFromVideoManager);
    } else {
      throw new Error("Result was successful but content was missing");
    }
  });

  it("should handle errors when fetching categories", async () => {
    // Configure VideoManagement mock to throw an error
    (mockVideoManager.getVideoCategories as jest.Mock).mockRejectedValue(
      new Error("API Error")
    );

    const params = { regionCode: "US" };
    const result = await getVideoCategoriesHandler(params, mockVideoManager);

    expect(mockVideoManager.getVideoCategories).toHaveBeenCalledWith("US");
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorResult = result.error as CallToolResult["error"];
      expect(errorResult.message).toBe("API Error");
      expect(result.content).toEqual([]); // Expect empty content array for errors
    }
  });

  it('should use default regionCode "US" if not provided', async () => {
    const mockCategories = [{ id: "10", title: "Music" }];
    (mockVideoManager.getVideoCategories as jest.Mock).mockResolvedValue(
      mockCategories
    );

    const params = {}; // No regionCode provided
    const result = await getVideoCategoriesHandler(params, mockVideoManager);

    // The handler itself applies the default, so getVideoCategories (from VideoManager) should be called with 'US'
    expect(mockVideoManager.getVideoCategories).toHaveBeenCalledWith("US");
    expect(result.success).toBe(true);
    if (result.success && result.content) {
      const returnedData = JSON.parse(result.content[0].text as string);
      expect(returnedData).toEqual(mockCategories);
    } else {
      throw new Error(
        "Result was successful but content was missing for default regionCode test"
      );
    }
  });
});
