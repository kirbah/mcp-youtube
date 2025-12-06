import { GetVideoCategoriesTool } from "../getVideoCategories";
import type { YoutubeService } from "../../../services/youtube.service";
import { IServiceContainer } from "../../../container";

// Only mock the service layer, not the external google library
jest.mock("../../../services/youtube.service");

describe("GetVideoCategoriesTool", () => {
  let mockYoutubeService: jest.Mocked<YoutubeService>;
  let tool: GetVideoCategoriesTool;

  beforeEach(() => {
    // Create a typed mock for the service
    mockYoutubeService = {
      getVideoCategories: jest.fn(),
    } as unknown as jest.Mocked<YoutubeService>;

    const container = {
      youtubeService: mockYoutubeService,
    } as unknown as IServiceContainer;

    tool = new GetVideoCategoriesTool(container);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe("getVideoCategories");
  });

  it("should return categories using the default regionCode 'US' when none is provided", async () => {
    const mockCategories = [
      { id: "1", title: "Film & Animation" },
      { id: "2", title: "Autos & Vehicles" },
    ];
    mockYoutubeService.getVideoCategories.mockResolvedValue(mockCategories);

    // Act: Call with empty object
    const result = await tool.execute({});

    // Assert: Zod default applied
    expect(mockYoutubeService.getVideoCategories).toHaveBeenCalledWith("US");

    // Assert: Result shape
    expect(result.success).toBe(true);
    expect(JSON.parse(result.content[0].text as string)).toEqual(
      mockCategories
    );
  });

  it("should return categories for a specifically provided regionCode", async () => {
    const mockCategories = [{ id: "10", title: "Music" }];
    mockYoutubeService.getVideoCategories.mockResolvedValue(mockCategories);

    const params = { regionCode: "JP" };
    await tool.execute(params);

    expect(mockYoutubeService.getVideoCategories).toHaveBeenCalledWith("JP");
  });

  it("should return a validation error if regionCode is invalid", async () => {
    const params = { regionCode: "USA" }; // Invalid: 3 letters, schema likely expects 2

    const result = await tool.execute(params);

    expect(mockYoutubeService.getVideoCategories).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    // BaseTool captures the Zod error; check for field specificity
    expect(result.content[0].text).toMatch(/regionCode/);
  });

  it("should handle service errors gracefully", async () => {
    const errorMessage = "YouTube API Error";
    mockYoutubeService.getVideoCategories.mockRejectedValue(
      new Error(errorMessage)
    );

    const result = await tool.execute({ regionCode: "US" });

    expect(mockYoutubeService.getVideoCategories).toHaveBeenCalledWith("US");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(errorMessage);
  });
});
