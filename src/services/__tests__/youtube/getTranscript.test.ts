import { YoutubeService } from "../../youtube.service";
import { getSubtitles } from "youtube-captions-scraper";

jest.mock("youtube-captions-scraper", () => ({
  getSubtitles: jest.fn(),
}));

describe("YoutubeService.getTranscript", () => {
  let videoManagement: YoutubeService;
  let mockGetSubtitles: jest.Mock;

  beforeEach(() => {
    // Initialize VideoManagement instance before each test
    videoManagement = new YoutubeService();
    // Reset the mock before each test
    mockGetSubtitles = getSubtitles as jest.Mock;
    mockGetSubtitles.mockClear();
  });

  it("should retrieve transcript successfully with specified language", async () => {
    const videoId = "testVideoId";
    const lang = "es";
    const mockTranscript = [{ text: "Hola mundo" }];
    mockGetSubtitles.mockResolvedValue(mockTranscript);

    const result = await videoManagement.getTranscript(videoId, lang);

    expect(mockGetSubtitles).toHaveBeenCalledWith({ videoID: videoId, lang });
    expect(result).toEqual(mockTranscript);
  });

  it('should use default language "en" when lang is not provided and YOUTUBE_TRANSCRIPT_LANG is not set', async () => {
    const videoId = "testVideoIdEn";
    const mockTranscript = [{ text: "Hello world" }];
    mockGetSubtitles.mockResolvedValue(mockTranscript);
    // Ensure YOUTUBE_TRANSCRIPT_LANG is not set for this test
    delete process.env.YOUTUBE_TRANSCRIPT_LANG;

    const result = await videoManagement.getTranscript(videoId);

    expect(mockGetSubtitles).toHaveBeenCalledWith({
      videoID: videoId,
      lang: "en",
    });
    expect(result).toEqual(mockTranscript);
  });

  it("should use YOUTUBE_TRANSCRIPT_LANG when lang is not provided and YOUTUBE_TRANSCRIPT_LANG is set", async () => {
    const videoId = "testVideoIdEnvLang";
    const envLang = "fr";
    process.env.YOUTUBE_TRANSCRIPT_LANG = envLang;
    const mockTranscript = [{ text: "Bonjour le monde" }];
    mockGetSubtitles.mockResolvedValue(mockTranscript);

    const result = await videoManagement.getTranscript(videoId);

    expect(mockGetSubtitles).toHaveBeenCalledWith({
      videoID: videoId,
      lang: envLang,
    });
    expect(result).toEqual(mockTranscript);

    // Clean up the environment variable
    delete process.env.YOUTUBE_TRANSCRIPT_LANG;
  });

  it("should throw an error if getSubtitles fails", async () => {
    const videoId = "testVideoIdError";
    const errorMessage = "Failed to fetch captions";
    mockGetSubtitles.mockRejectedValue(new Error(errorMessage));

    await expect(videoManagement.getTranscript(videoId)).rejects.toThrow(
      `Failed to retrieve transcript: ${errorMessage}`
    );
    expect(mockGetSubtitles).toHaveBeenCalledWith({
      videoID: videoId,
      lang: "en",
    }); // Assumes 'en' as fallback
  });
});
