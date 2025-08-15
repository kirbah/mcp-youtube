import { getTranscriptsHandler } from "../getTranscripts";
import { TranscriptService } from "../../../services/transcript.service"; // Corrected import
import { formatVideoMap } from "../../../utils/responseFormatter";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types";
import { mocked } from "jest-mock"; // Import mocked

jest.mock("../../../services/transcript.service"); // Mock TranscriptService

describe("getTranscriptsHandler", () => {
  let mockTranscriptService: jest.Mocked<TranscriptService>; // Renamed mock variable

  beforeEach(() => {
    mockTranscriptService = mocked(new TranscriptService(null as any)); // Use mocked
    mockTranscriptService.getTranscriptSegments = jest.fn(); // Mock the correct method

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if ((console.error as any).mockRestore) {
      (console.error as any).mockRestore();
    }
    jest.clearAllMocks();
  });

  it("should successfully return transcript for a single video", async () => {
    const mockInput = {
      videoIds: ["testVideoId1"],
      lang: "en",
      format: "key_segments",
    };
    const mockTranscript = [{ text: "Hello world", offset: 0, duration: 100 }];

    mockTranscriptService.getTranscriptSegments.mockResolvedValue(
      mockTranscript
    );

    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    const mapOutput = formatVideoMap(mockInput.videoIds, [mockTranscript]);
    const expectedResponse = {
      success: true,
      content: [{ type: "text", text: JSON.stringify(mapOutput, null, 2) }],
    };

    expect(result).toEqual(expectedResponse);
    expect(mockTranscriptService.getTranscriptSegments).toHaveBeenCalledWith(
      "testVideoId1",
      "en",
      "key_segments"
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should successfully return transcripts for multiple videos with the specified lang", async () => {
    const mockInput = {
      videoIds: ["testVideoId1", "testVideoId2"],
      lang: "fr",
      format: "key_segments",
    };
    const mockTranscript1 = [{ text: "Bonjour", offset: 0, duration: 100 }];
    const mockTranscript2 = [{ text: "Salut", offset: 0, duration: 120 }];

    mockTranscriptService.getTranscriptSegments
      .mockResolvedValueOnce(mockTranscript1)
      .mockResolvedValueOnce(mockTranscript2);

    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    const mapOutput = formatVideoMap(mockInput.videoIds, [
      mockTranscript1,
      mockTranscript2,
    ]);
    const expectedResponse = {
      success: true,
      content: [{ type: "text", text: JSON.stringify(mapOutput, null, 2) }],
    };

    expect(result).toEqual(expectedResponse);
    expect(mockTranscriptService.getTranscriptSegments).toHaveBeenCalledWith(
      "testVideoId1",
      "fr",
      "key_segments"
    );
    expect(mockTranscriptService.getTranscriptSegments).toHaveBeenCalledWith(
      "testVideoId2",
      "fr",
      "key_segments"
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should return an error if getTranscriptSegments fails for any video", async () => {
    const mockInput = {
      videoIds: ["testVideoId1", "testVideoId2"],
      lang: "es",
      format: "key_segments",
    };
    const mockTranscript1 = [{ text: "Hola", offset: 0, duration: 100 }];
    const mockError = new Error("Failed to fetch transcript for testVideoId2");

    mockTranscriptService.getTranscriptSegments
      .mockResolvedValueOnce(mockTranscript1)
      .mockRejectedValueOnce(mockError);

    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (result.error) {
      const errorResult = result.error as CallToolResult["error"];
      expect(errorResult.error).toBe("ToolExecutionError");
      expect(errorResult.message).toBe(
        "Failed to fetch transcript for testVideoId2"
      );
    }
    expect(mockTranscriptService.getTranscriptSegments).toHaveBeenCalledWith(
      "testVideoId1",
      "es",
      "key_segments"
    );
    expect(mockTranscriptService.getTranscriptSegments).toHaveBeenCalledWith(
      "testVideoId2",
      "es",
      "key_segments"
    );
  });

  it("should return an empty success response if videoIds array is empty", async () => {
    const mockInput = {
      videoIds: [],
      lang: "en",
      format: "key_segments",
    };

    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    const mapOutput = formatVideoMap(mockInput.videoIds, []);
    const expectedResponse = {
      success: true,
      content: [{ type: "text", text: JSON.stringify(mapOutput) }],
    };

    expect(result).toEqual(expectedResponse);
    expect(mockTranscriptService.getTranscriptSegments).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should use default language "en" if lang is not provided in params', async () => {
    const mockInput = {
      videoIds: ["testVideoIdNoLang"],
      format: "key_segments",
    };
    const mockTranscript = [
      { text: "Default lang transcript", offset: 0, duration: 150 },
    ];

    mockTranscriptService.getTranscriptSegments.mockResolvedValue(
      mockTranscript
    );

    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    const mapOutput = formatVideoMap(mockInput.videoIds, [mockTranscript]);
    const expectedResponse = {
      success: true,
      content: [{ type: "text", text: JSON.stringify(mapOutput, null, 2) }],
    };

    expect(result).toEqual(expectedResponse);
    expect(mockTranscriptService.getTranscriptSegments).toHaveBeenCalledWith(
      "testVideoIdNoLang",
      "en",
      "key_segments"
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should return a Zod validation error if videoIds is not an array", async () => {
    const mockInput = { videoIds: "not-an-array", lang: "en" } as any;
    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (result.error) {
      const errorResult = result.error as CallToolResult["error"];
      expect(errorResult.error).toBe("ToolExecutionError");
      const parsedMessage = JSON.parse(errorResult.message);
      expect(parsedMessage[0].message).toBe("Expected array, received string");
    }
    expect(mockTranscriptService.getTranscriptSegments).not.toHaveBeenCalled();
  });

  it("should return a Zod validation error if a videoId in videoIds array is not a string", async () => {
    const mockInput = { videoIds: ["validId", 123], lang: "en" } as any;
    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (result.error) {
      const errorResult = result.error as CallToolResult["error"];
      expect(errorResult.error).toBe("ToolExecutionError");
      const parsedMessage = JSON.parse(errorResult.message);
      expect(parsedMessage[0].message).toBe("Expected string, received number");
    }
    expect(mockTranscriptService.getTranscriptSegments).not.toHaveBeenCalled();
  });

  it("should return a Zod validation error if videoIds array contains a single non-string element", async () => {
    const mockInput = { videoIds: [123], lang: "en" } as any;
    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (result.error) {
      const errorResult = result.error as CallToolResult["error"];
      expect(errorResult.error).toBe("ToolExecutionError");
      const parsedMessage = JSON.parse(errorResult.message);
      expect(parsedMessage[0].message).toBe("Expected string, received number");
    }
    expect(mockTranscriptService.getTranscriptSegments).not.toHaveBeenCalled();
  });

  it("should return a Zod validation error if lang is not a string (and not undefined)", async () => {
    const mockInput = { videoIds: ["vid1"], lang: 123 } as any;
    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (result.error) {
      const errorResult = result.error as CallToolResult["error"];
      expect(errorResult.error).toBe("ToolExecutionError");
      const parsedMessage = JSON.parse(errorResult.message);
      expect(parsedMessage[0].message).toBe("Expected string, received number");
    }
    expect(mockTranscriptService.getTranscriptSegments).not.toHaveBeenCalled();
  });

  it('should successfully process requests with longer language codes like "en-US"', async () => {
    const mockInput = {
      videoIds: ["testVideoId1"],
      lang: "en-US",
      format: "key_segments",
    };
    const mockTranscript = [
      { text: "Hello US English", offset: 0, duration: 100 },
    ];

    mockTranscriptService.getTranscriptSegments.mockResolvedValue(
      mockTranscript
    );

    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    expect(result.success).toBe(true);
    const mapOutput = formatVideoMap(mockInput.videoIds, [mockTranscript]);
    const expectedResponse = {
      success: true,
      content: [{ type: "text", text: JSON.stringify(mapOutput, null, 2) }],
    };
    expect(result).toEqual(expectedResponse);
    expect(mockTranscriptService.getTranscriptSegments).toHaveBeenCalledWith(
      mockInput.videoIds[0],
      "en-US",
      "key_segments"
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should return a Zod validation error if videoId in array is an empty string", async () => {
    const mockInput = { videoIds: [""], lang: "en" } as any;
    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (result.error) {
      const errorResult = result.error as CallToolResult["error"];
      if (errorResult.message) {
        expect(errorResult.error).toBe("ToolExecutionError");
        const parsedMessage = JSON.parse(errorResult.message);
        expect(parsedMessage[0].message).toBe("Video ID cannot be empty");
      } else {
        throw new Error(
          "Expected error message for empty videoId was not defined."
        );
      }
    }
    expect(mockTranscriptService.getTranscriptSegments).not.toHaveBeenCalled();
  });

  it("should return a Zod validation error if videoId in array is an empty string", async () => {
    const mockInput = { videoIds: [""], lang: "en" } as any;
    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (result.error) {
      const errorResult = result.error as CallToolResult["error"];
      expect(errorResult.error).toBe("ToolExecutionError");
      const parsedMessage = JSON.parse(errorResult.message);
      expect(parsedMessage[0].message).toBe("Video ID cannot be empty");
    }
    expect(mockTranscriptService.getTranscriptSegments).not.toHaveBeenCalled();
  });

  it("should return a Zod validation error if videoIds array is missing (if schema requires it, e.g. not optional)", async () => {
    const mockInput = { lang: "en" } as any;
    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (result.error) {
      const errorResult = result.error as CallToolResult["error"];
      expect(errorResult.error).toBe("ToolExecutionError");
      const parsedMessage = JSON.parse(errorResult.message);
      expect(parsedMessage[0].message).toBe("Required");
    }
    expect(mockTranscriptService.getTranscriptSegments).not.toHaveBeenCalled();
  });

  it('should successfully process if lang is undefined (and defaults to "en" in schema)', async () => {
    const mockInput = { videoIds: ["testVideoIdDefaultLang"] };
    const mockTranscript = [
      { text: "Transcript with default lang", offset: 0, duration: 180 },
    ];

    mockTranscriptService.getTranscriptSegments.mockResolvedValue(
      mockTranscript
    );
    const result = await getTranscriptsHandler(
      mockInput,
      mockTranscriptService
    );

    const mapOutput = formatVideoMap(mockInput.videoIds, [mockTranscript]);
    const expectedResponse = {
      success: true,
      content: [{ type: "text", text: JSON.stringify(mapOutput, null, 2) }],
    };

    expect(result).toEqual(expectedResponse);
    expect(mockTranscriptService.getTranscriptSegments).toHaveBeenCalledWith(
      "testVideoIdDefaultLang",
      "en",
      "key_segments"
    );
    expect(console.error).not.toHaveBeenCalled();
  });
});
