import { findConsistentOutlierChannelsHandler } from "../findConsistentOutlierChannels";
import { NicheAnalyzerService } from "../../../services/nicheAnalyzer.service";
import { YoutubeService } from "../../../services/youtube.service";
import { Db } from "mongodb";

// Mock dependencies
// IMPORTANT: Mock the class here, not just its prototype for full control if needed elsewhere.
jest.mock("../../../services/nicheAnalyzer.service");
jest.mock("../../../services/youtube.service");
jest.mock("../../../services/analysis/niche.repository");
jest.mock("mongodb");

describe("findConsistentOutlierChannelsHandler", () => {
  let mockYoutubeService: jest.Mocked<YoutubeService>;
  let mockDb: jest.Mocked<Db>;
  // NicheRepository is instantiated within the handler, so we don't need a top-level mock instance for it.
  // NicheAnalyzerService is also instantiated within the handler.

  beforeEach(() => {
    jest.clearAllMocks();

    // Assign a Jest mock function to the prototype method.
    // This ensures that any instance of NicheAnalyzerService created will use this mock.
    NicheAnalyzerService.prototype.findConsistentOutlierChannels = jest.fn();

    // Create fresh mock instances for services passed as arguments to the handler
    mockYoutubeService = new YoutubeService({} as any);
    mockDb = new Db("test", "test") as jest.Mocked<Db>;

    // If YoutubeService or Db methods were called, they would need setup here, e.g.:
    // mockYoutubeService.someMethod = jest.fn().mockResolvedValue(...);

    // NicheRepository is newed up inside handler. If its methods were called by
    // NicheAnalyzerService.findConsistentOutlierChannels OR if NicheAnalyzerService constructor
    // did something complex with it, we might need to mock NicheRepository.prototype methods too.
    // For now, assuming it's simple or its interactions are not part of these specific tests' assertions.
  });

  it("should call NicheAnalyzerService.findConsistentOutlierChannels with correct parameters and return data", async () => {
    // Arrange
    const mockRequestParams = {
      query: "test keyword", // Changed from keywords to query to match schema
      // ... other valid parameters based on findConsistentOutlierChannelsSchema ...
      maxResults: 10,
    };

    const mockOutlierChannels = [{ channelId: "UC-test-channel" }];
    (
      NicheAnalyzerService.prototype.findConsistentOutlierChannels as jest.Mock
    ).mockResolvedValue(mockOutlierChannels);

    // Act
    // The handler expects (params, youtubeService, db)
    // It does not use Express-style req/res objects.
    const result = await findConsistentOutlierChannelsHandler(
      mockRequestParams as any,
      mockYoutubeService,
      mockDb
    );

    // Assert
    // The first argument to findConsistentOutlierChannels is the validated params object.
    // The original test was checking against individual properties from a `body` object.
    // We need to ensure the schema validation inside the handler would pass with mockRequestParams.
    // For simplicity, we'll assume mockRequestParams is already validated for this assertion.
    expect(
      NicheAnalyzerService.prototype.findConsistentOutlierChannels
    ).toHaveBeenCalledWith(
      expect.objectContaining({ query: "test keyword", maxResults: 10 })
    );

    // The handler returns a CallToolResult, check its structure
    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content?.length).toBe(1);
    expect(result.content?.[0].type).toBe("text");
    expect(JSON.parse(result.content![0].text)).toEqual(mockOutlierChannels);
  });

  it("should return a formatted error if NicheAnalyzerService.findConsistentOutlierChannels throws an error", async () => {
    // Arrange
    const mockRequestParams = {
      query: "test keyword",
      // ... other parameters
    };

    const errorMessage = "Test error from service";
    (
      NicheAnalyzerService.prototype.findConsistentOutlierChannels as jest.Mock
    ).mockRejectedValue(new Error(errorMessage));

    // Act
    const result = await findConsistentOutlierChannelsHandler(
      mockRequestParams as any,
      mockYoutubeService,
      mockDb
    );

    // Assert
    // The handler uses formatError, so the result should match that structure.
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe(errorMessage);
    expect(result.error?.error).toBe("ToolExecutionError");
  });

  it("should return a formatted error if input parameters are invalid (e.g., query missing)", async () => {
    // Arrange
    const mockRequestParams = {
      // query is missing, which findConsistentOutlierChannelsSchema will reject
      maxResults: 10,
    };

    // We don't need to mock findConsistentOutlierChannels here, as schema validation should fail first.

    // Act
    const result = await findConsistentOutlierChannelsHandler(
      mockRequestParams as any,
      mockYoutubeService,
      mockDb
    );

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.error).toBe("ToolExecutionError");
    // The message from ZodError (which is error.message when error is ZodError) is a JSON string of issues.
    // We expect it to contain the message "Required" for the "query" path.
    expect(result.error?.message).toBeDefined();
    expect(result.error?.message).toContain("Required"); // Zod's default message for missing required string
    expect(result.error?.message).toContain("query"); // Check that the error is related to the 'query' field

    // To be more precise, we can parse the JSON string in error.message
    const zodIssues = JSON.parse(result.error!.message);
    expect(Array.isArray(zodIssues)).toBe(true);
    expect(zodIssues.length).toBeGreaterThan(0);
    expect(zodIssues[0].code).toBe("invalid_type"); // Zod uses invalid_type when undefined is passed for a required string
    expect(zodIssues[0].path).toEqual(["query"]);
    expect(zodIssues[0].message).toBe("Required");
  });
});
