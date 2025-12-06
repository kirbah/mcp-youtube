import { GetTranscriptsTool } from "../getTranscripts";
import type { TranscriptService } from "../../../services/transcript.service";
import { IServiceContainer } from "../../../container";

jest.mock("../../../services/transcript.service");

describe("GetTranscriptsTool", () => {
  let mockTranscriptService: jest.Mocked<TranscriptService>;
  let tool: GetTranscriptsTool;

  beforeEach(() => {
    mockTranscriptService = {
      getTranscriptSegments: jest.fn(),
    } as unknown as jest.Mocked<TranscriptService>;

    const container = {
      transcriptService: mockTranscriptService,
    } as unknown as IServiceContainer;

    tool = new GetTranscriptsTool(container);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe("getTranscripts");
  });

  it("should return a successful result with the correct content", async () => {
    const mockTranscript = { intro: "Hello", outro: "World" };
    mockTranscriptService.getTranscriptSegments.mockResolvedValue(
      mockTranscript as any
    );

    const params = { videoIds: ["1"] };
    const result = await tool.execute(params);

    expect(result.success).toBe(true);
    if (!result.success || !result.content)
      throw new Error("Test failed: success true but no content");
    const returnedData = JSON.parse(result.content[0].text as string);

    expect(returnedData).toEqual({ "1": mockTranscript });
  });

  it("should return an error if transcriptService.getTranscriptSegments throws an error", async () => {
    mockTranscriptService.getTranscriptSegments.mockRejectedValue(
      new Error("Transcript not available")
    );

    const params = { videoIds: ["1"] };
    const result = await tool.execute(params);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Transcript not available");
  });

  it("should return a Zod validation error for invalid parameters", async () => {
    const invalidParams = { videoIds: [""] }; // videoId cannot be empty
    const result = await tool.execute(invalidParams);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Video ID cannot be empty");
  });
});
