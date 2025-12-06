import { GetVideoCommentsTool } from "../getVideoComments";
import type { YoutubeService } from "../../../services/youtube.service";
import { IServiceContainer } from "../../../container";

jest.mock("../../../services/youtube.service");

describe("GetVideoCommentsTool", () => {
  let mockYoutubeService: jest.Mocked<YoutubeService>;
  let tool: GetVideoCommentsTool;

  beforeEach(() => {
    mockYoutubeService = {
      getVideoComments: jest.fn(),
    } as unknown as jest.Mocked<YoutubeService>;

    const container = {
      youtubeService: mockYoutubeService,
    } as unknown as IServiceContainer;

    tool = new GetVideoCommentsTool(container);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe("getVideoComments");
  });

  it("should return a successful result with the correct content", async () => {
    const mockComments = [{ text: "Great video!" }];
    mockYoutubeService.getVideoComments.mockResolvedValue(mockComments as any);

    const params = { videoId: "1" };
    const result = await tool.execute(params);

    expect(result.success).toBe(true);
    if (!result.success || !result.content)
      throw new Error("Test failed: success true but no content");
    const returnedData = JSON.parse(result.content[0].text as string);

    expect(returnedData).toEqual(mockComments);
  });

  it("should return an error if youtubeService.getVideoComments throws an error", async () => {
    mockYoutubeService.getVideoComments.mockRejectedValue(
      new Error("Comments are disabled")
    );

    const params = { videoId: "1" };
    const result = await tool.execute(params);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Comments are disabled");
  });

  it("should return a Zod validation error for invalid parameters", async () => {
    const invalidParams = { videoId: "" }; // videoId cannot be empty
    const result = await tool.execute(invalidParams);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Too small: expected string to have >=1 characters");
  });
});
