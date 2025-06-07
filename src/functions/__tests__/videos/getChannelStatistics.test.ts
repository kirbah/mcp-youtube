import { VideoManagement } from "../../videos";
import { google } from "googleapis";

jest.mock("googleapis", () => {
  const mockChannelsList = jest.fn();
  return {
    google: {
      youtube: jest.fn(() => ({
        channels: {
          list: mockChannelsList,
        },
      })),
    },
    // Export the mock function so we can manipulate it in tests
    __mockChannelsList: mockChannelsList,
  };
});

// Destructure the mock function for easier access in tests
const { __mockChannelsList: mockChannelsList } = jest.requireMock("googleapis");

describe("VideoManagement.getChannelStatistics", () => {
  let videoManagement: VideoManagement;

  beforeEach(() => {
    // Reset the mock before each test
    mockChannelsList.mockReset();
    // Set the required environment variable
    process.env.YOUTUBE_API_KEY = "test_api_key";
    videoManagement = new VideoManagement();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.YOUTUBE_API_KEY;
  });

  it("should retrieve and process channel statistics correctly", async () => {
    const mockChannelData = {
      items: [
        {
          snippet: {
            title: "Test Channel",
            publishedAt: "2023-01-01T00:00:00Z",
          },
          statistics: {
            subscriberCount: "1000",
            viewCount: "100000",
            videoCount: "100",
          },
        },
      ],
    };
    mockChannelsList.mockResolvedValueOnce({ data: mockChannelData });

    const stats = await videoManagement.getChannelStatistics("test_channel_id");

    expect(stats).toEqual({
      channelId: "test_channel_id",
      title: "Test Channel",
      subscriberCount: 1000,
      viewCount: 100000,
      videoCount: 100,
      createdAt: "2023-01-01T00:00:00Z",
    });
    expect(google.youtube).toHaveBeenCalledWith({
      version: "v3",
      auth: "test_api_key",
    });
    expect(mockChannelsList).toHaveBeenCalledWith({
      part: ["snippet", "statistics"],
      id: ["test_channel_id"],
    });
  });

  it("should throw an error if channel is not found", async () => {
    mockChannelsList.mockResolvedValueOnce({ data: { items: [] } });

    await expect(
      videoManagement.getChannelStatistics("unknown_channel_id")
    ).rejects.toThrow("Channel not found.");
  });

  it("should throw an error if API call fails", async () => {
    mockChannelsList.mockRejectedValueOnce(new Error("API Error"));

    await expect(
      videoManagement.getChannelStatistics("test_channel_id")
    ).rejects.toThrow("Failed to retrieve channel statistics: API Error");
  });
});
