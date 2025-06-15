import { YoutubeService, VideoOptions } from "../../youtube.service";
import { google } from "googleapis";

// Mock the googleapis library
jest.mock("googleapis", () => ({
  google: {
    youtube: jest.fn(() => ({
      videos: {
        list: jest.fn(),
      },
    })),
  },
}));

// Mock VideoManagement constructor dependencies if any (e.g., API key)
// For this example, assuming YOUTUBE_API_KEY is set in the environment for the constructor
// or handle its mocking if it's passed differently.
// If the constructor directly uses process.env.YOUTUBE_API_KEY, ensure it's set for tests or mock process.env.

describe("YoutubeService.getVideo", () => {
  let videoManagement: YoutubeService;
  let mockYoutubeVideosList: jest.Mock;

  beforeEach(() => {
    // Reset the mock before each test
    mockYoutubeVideosList = jest.fn();
    (google.youtube as jest.Mock).mockReturnValue({
      videos: {
        list: mockYoutubeVideosList,
      },
    });
    videoManagement = new YoutubeService();
    // Ensure process.env.YOUTUBE_API_KEY is mocked or set if your VideoManagement constructor relies on it directly.
    // For instance: process.env.YOUTUBE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    jest.clearAllMocks();
    // delete process.env.YOUTUBE_API_KEY; // Clean up env var if set
  });

  // Tests will be added here in the next step
  it("should retrieve video details successfully", async () => {
    const mockVideoId = "testVideoId";
    const mockVideoResponse = {
      data: {
        items: [{ id: mockVideoId, snippet: { title: "Test Video" } }],
      },
    };
    mockYoutubeVideosList.mockResolvedValue(mockVideoResponse);

    const videoOptions: VideoOptions = {
      videoId: mockVideoId,
      parts: ["snippet"],
    };
    const result = await videoManagement.getVideo(videoOptions);

    expect(result).toEqual(mockVideoResponse.data.items[0]);
    expect(mockYoutubeVideosList).toHaveBeenCalledWith({
      part: ["snippet"],
      id: [mockVideoId],
    });
  });

  it('should throw "Video not found" error when no items are returned', async () => {
    const mockVideoId = "nonExistentVideoId";
    mockYoutubeVideosList.mockResolvedValue({ data: { items: [] } });

    const videoOptions: VideoOptions = { videoId: mockVideoId };
    await expect(videoManagement.getVideo(videoOptions)).rejects.toThrow(
      "Video not found."
    );
    expect(mockYoutubeVideosList).toHaveBeenCalledWith({
      part: ["snippet"], // Default part
      id: [mockVideoId],
    });
  });

  it("should throw an error if the YouTube API call fails", async () => {
    const mockVideoId = "testVideoId";
    const errorMessage = "API Error";
    mockYoutubeVideosList.mockRejectedValue(new Error(errorMessage));

    const videoOptions: VideoOptions = { videoId: mockVideoId };
    await expect(videoManagement.getVideo(videoOptions)).rejects.toThrow(
      `Failed to retrieve video information: ${errorMessage}`
    );
  });

  it("should request specified parts when provided", async () => {
    const mockVideoId = "testVideoIdWithParts";
    const mockVideoResponse = {
      data: {
        items: [
          {
            id: mockVideoId,
            snippet: { title: "Test Video" },
            statistics: { viewCount: "100" },
          },
        ],
      },
    };
    mockYoutubeVideosList.mockResolvedValue(mockVideoResponse);

    const videoOptions: VideoOptions = {
      videoId: mockVideoId,
      parts: ["snippet", "statistics"],
    };
    await videoManagement.getVideo(videoOptions);

    expect(mockYoutubeVideosList).toHaveBeenCalledWith({
      part: ["snippet", "statistics"],
      id: [mockVideoId],
    });
  });

  it('should use default part "snippet" if no parts are specified', async () => {
    const mockVideoId = "testVideoIdDefaultPart";
    const mockVideoResponse = {
      data: {
        items: [
          { id: mockVideoId, snippet: { title: "Test Video Default Part" } },
        ],
      },
    };
    mockYoutubeVideosList.mockResolvedValue(mockVideoResponse);

    const videoOptions: VideoOptions = { videoId: mockVideoId };
    await videoManagement.getVideo(videoOptions);

    expect(mockYoutubeVideosList).toHaveBeenCalledWith({
      part: ["snippet"], // Default part
      id: [mockVideoId],
    });
  });
});
