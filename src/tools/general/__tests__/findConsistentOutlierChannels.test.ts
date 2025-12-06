import { FindConsistentOutlierChannelsTool } from "../findConsistentOutlierChannels";
import { NicheAnalyzerService } from "../../../services/nicheAnalyzer.service";
import { NicheRepository } from "../../../services/analysis/niche.repository";
import { YoutubeService } from "../../../services/youtube.service";
import { IServiceContainer } from "../../../container";

// Mock the dependencies that are instantiated inside the Tool
jest.mock("../../../services/nicheAnalyzer.service");
jest.mock("../../../services/analysis/niche.repository");
// Mock the dependency passed via container
jest.mock("../../../services/youtube.service");

describe("FindConsistentOutlierChannelsTool", () => {
  let mockYoutubeService: jest.Mocked<YoutubeService>;
  let mockNicheAnalyzerInstance: {
    findConsistentOutlierChannels: jest.Mock;
  };
  let tool: FindConsistentOutlierChannelsTool;

  beforeEach(() => {
    // 1. Setup Container Mock
    mockYoutubeService = {} as unknown as jest.Mocked<YoutubeService>;
    const container = {
      youtubeService: mockYoutubeService,
    } as unknown as IServiceContainer;

    // 2. Setup NicheAnalyzerService Mock (Constructor & Instance)
    mockNicheAnalyzerInstance = {
      findConsistentOutlierChannels: jest.fn(),
    };
    (NicheAnalyzerService as jest.Mock).mockImplementation(
      () => mockNicheAnalyzerInstance
    );

    // 3. Setup NicheRepository Mock (Constructor)
    (NicheRepository as jest.Mock).mockImplementation(() => ({}));

    // 4. Initialize Tool
    tool = new FindConsistentOutlierChannelsTool(container);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe("findConsistentOutlierChannels");
  });

  it("should validate inputs, instantiate services, and return results", async () => {
    // Arrange
    const mockOutlierChannels = [
      { channelId: "UC-test", title: "Test Channel" },
    ];
    mockNicheAnalyzerInstance.findConsistentOutlierChannels.mockResolvedValue(
      mockOutlierChannels
    );

    const params = {
      query: "test niche",
      maxResults: 5,
    };

    // Act
    const result = await tool.execute(params);

    // Assert: Check Service Instantiation
    expect(NicheRepository).toHaveBeenCalledTimes(1);
    expect(NicheAnalyzerService).toHaveBeenCalledTimes(1);
    expect(NicheAnalyzerService).toHaveBeenCalledWith(
      mockYoutubeService,
      expect.any(Object) // The mock repository instance
    );

    // Assert: Check Method Call with Defaults + Explicit Params
    expect(
      mockNicheAnalyzerInstance.findConsistentOutlierChannels
    ).toHaveBeenCalledWith({
      query: "test niche",
      maxResults: 5,
      channelAge: "NEW", // Default from Zod
      consistencyLevel: "MODERATE", // Default from Zod
      outlierMagnitude: "STANDARD", // Default from Zod
    });

    // Assert: Check Result
    expect(result.success).toBe(true);
    expect(JSON.parse(result.content[0].text as string)).toEqual(
      mockOutlierChannels
    );
  });

  it("should correctly pass all optional parameters", async () => {
    mockNicheAnalyzerInstance.findConsistentOutlierChannels.mockResolvedValue(
      []
    );

    const params = {
      query: "advanced niche",
      channelAge: "ESTABLISHED" as const,
      consistencyLevel: "HIGH" as const,
      outlierMagnitude: "STRONG" as const,
      regionCode: "DE",
      videoCategoryId: "27",
      maxResults: 20,
    };

    await tool.execute(params);

    expect(
      mockNicheAnalyzerInstance.findConsistentOutlierChannels
    ).toHaveBeenCalledWith(params);
  });

  it("should return a validation error if query is missing", async () => {
    // @ts-ignore - deliberately passing empty object to test required field
    const result = await tool.execute({});

    expect(
      mockNicheAnalyzerInstance.findConsistentOutlierChannels
    ).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    // Zod error for required field
    expect(result.content[0].text).toContain(
      "Invalid input: expected string, received undefined"
    );
  });

  it("should return a validation error if regionCode is invalid", async () => {
    const params = {
      query: "test",
      regionCode: "INVALID_CODE", // Too long
    };

    const result = await tool.execute(params);

    expect(
      mockNicheAnalyzerInstance.findConsistentOutlierChannels
    ).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/regionCode/);
  });

  it("should handle service errors gracefully", async () => {
    const errorMessage = "Analyzer failed";
    mockNicheAnalyzerInstance.findConsistentOutlierChannels.mockRejectedValue(
      new Error(errorMessage)
    );

    const params = { query: "test" };
    const result = await tool.execute(params);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(errorMessage);
  });
});
