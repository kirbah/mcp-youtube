import { TranscriptService } from "../transcript.service";
import { CacheService } from "../cache.service";
import { fetchTranscript } from "youtube-transcript-plus";

// Mock the dependencies
jest.mock("../cache.service");
jest.mock("youtube-transcript-plus", () => ({
  fetchTranscript: jest.fn(),
}));

const mockFetchTranscript = fetchTranscript as jest.Mock;
const MockCacheService = CacheService;

describe("TranscriptService", () => {
  let transcriptService: TranscriptService;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Provide a mock implementation of CacheService
    cacheService = new MockCacheService(null);
    transcriptService = new TranscriptService(cacheService);
  });

  describe("getTranscriptSegments", () => {
    const mockSubtitles = [
      { start: "0", dur: "5", text: "This is the hook." },
      { start: "40", dur: "5", text: "This is the middle." },
      { start: "80", dur: "5", text: "This is the outro." },
    ];

    it("should return a { hook, outro } object for format 'key_segments'", async () => {
      // @ts-ignore
      transcriptService.fetchAndCacheRawTranscript = jest
        .fn()
        .mockResolvedValue(mockSubtitles);
      const result = await transcriptService.getTranscriptSegments(
        "video1",
        "en",
        "key_segments"
      );
      expect(result).toEqual({
        hook: "This is the hook.",
        outro: "This is the outro.",
      });
    });

    it("should return a { transcript } object for format 'full_text'", async () => {
      // @ts-ignore
      transcriptService.fetchAndCacheRawTranscript = jest
        .fn()
        .mockResolvedValue(mockSubtitles);
      const result = await transcriptService.getTranscriptSegments(
        "video1",
        "en",
        "full_text"
      );
      expect(result).toEqual({
        transcript: "This is the hook. This is the middle. This is the outro.",
      });
    });

    it("should return null if the transcript is empty", async () => {
      // @ts-ignore
      transcriptService.fetchAndCacheRawTranscript = jest
        .fn()
        .mockResolvedValue([]);
      const result = await transcriptService.getTranscriptSegments("video1");
      expect(result).toBeNull();
    });

    it("should return null if the transcript is null", async () => {
      // @ts-ignore
      transcriptService.fetchAndCacheRawTranscript = jest
        .fn()
        .mockResolvedValue(null);
      const result = await transcriptService.getTranscriptSegments("video1");
      expect(result).toBeNull();
    });

    it("should default to format 'key_segments' and lang 'en'", async () => {
      // @ts-ignore
      transcriptService.fetchAndCacheRawTranscript = jest
        .fn()
        .mockResolvedValue(mockSubtitles);
      const result = await transcriptService.getTranscriptSegments("video1");
      expect(result).toEqual({
        hook: "This is the hook.",
        outro: "This is the outro.",
      });
      expect(transcriptService.fetchAndCacheRawTranscript).toHaveBeenCalledWith(
        "video1",
        "en"
      );
    });
  });

  describe("fetchAndCacheRawTranscript", () => {
    const mockApiResponse = [{ text: "hello world", offset: 0, duration: 1 }];
    const expectedSubtitles = [{ text: "hello world", start: "0", dur: "1" }];
    const videoId = "video1";
    const lang = "en";
    const cacheKey = "someCacheKey";

    beforeEach(() => {
      cacheService.createOperationKey.mockReturnValue(cacheKey);
    });

    it("should call fetchTranscript when cache is empty and return mapped data", async () => {
      cacheService.getOrSet.mockImplementation(async (key, operation) =>
        operation()
      );
      mockFetchTranscript.mockResolvedValue(mockApiResponse);

      // @ts-ignore
      const result = await transcriptService.fetchAndCacheRawTranscript(
        videoId,
        lang
      );

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Function),
        expect.any(Number),
        expect.any(String),
        expect.any(Object)
      );
      expect(mockFetchTranscript).toHaveBeenCalledWith(videoId, { lang });
      expect(result).toEqual(expectedSubtitles);
    });

    it("should return an empty array if fetchTranscript call fails", async () => {
      cacheService.getOrSet.mockImplementation(async (key, operation) =>
        operation()
      );
      mockFetchTranscript.mockRejectedValue(new Error("Fetch failed"));

      // @ts-ignore
      const result = await transcriptService.fetchAndCacheRawTranscript(
        videoId,
        lang
      );

      expect(result).toEqual([]);
    });

    it("should return data from cache without calling fetchTranscript", async () => {
      cacheService.getOrSet.mockResolvedValue(expectedSubtitles);

      // @ts-ignore
      const result = await transcriptService.fetchAndCacheRawTranscript(
        videoId,
        lang
      );

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Function),
        expect.any(Number),
        expect.any(String),
        expect.any(Object)
      );
      expect(mockFetchTranscript).not.toHaveBeenCalled();
      expect(result).toEqual(expectedSubtitles);
    });
  });

  describe("extractHook and extractOutro", () => {
    describe("extractHook", () => {
      it("should return text from the first 40 seconds for a long video", () => {
        const subtitles = [
          { start: "10", dur: "5", text: "Part 1." },
          { start: "30", dur: "5", text: "Part 2." },
          { start: "50", dur: "5", text: "Part 3." },
        ];
        // @ts-ignore
        const result = transcriptService.extractHook(subtitles);
        expect(result).toBe("Part 1. Part 2.");
      });

      it("should return the entire text for a video shorter than 40 seconds", () => {
        const subtitles = [
          { start: "5", dur: "5", text: "Short video." },
          { start: "15", dur: "5", text: "All of it." },
        ];
        // @ts-ignore
        const result = transcriptService.extractHook(subtitles);
        expect(result).toBe("Short video. All of it.");
      });

      it("should return an empty string for an empty transcript", () => {
        // @ts-ignore
        const result = transcriptService.extractHook([]);
        expect(result).toBe("");
      });
    });

    describe("extractOutro", () => {
      it("should return text from the last 30 seconds for a long video", () => {
        const subtitles = [
          { start: "10", dur: "5", text: "Part 1." },
          { start: "50", dur: "5", text: "Part 2." },
          { start: "70", dur: "5", text: "Part 3." },
        ];
        // @ts-ignore
        const result = transcriptService.extractOutro(subtitles);
        expect(result).toBe("Part 2. Part 3.");
      });

      it("should return the entire text for a video shorter than 30 seconds", () => {
        const subtitles = [
          { start: "5", dur: "5", text: "Short video." },
          { start: "15", dur: "5", text: "All of it." },
        ];
        // @ts-ignore
        const result = transcriptService.extractOutro(subtitles);
        expect(result).toBe("Short video. All of it.");
      });

      it("should return an empty string for an empty transcript", () => {
        // @ts-ignore
        const result = transcriptService.extractOutro([]);
        expect(result).toBe("");
      });
    });
  });
});
