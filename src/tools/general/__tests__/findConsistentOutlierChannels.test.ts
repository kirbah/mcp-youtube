import {
  findConsistentOutlierChannelsHandler,
  findConsistentOutlierChannelsSchema,
} from "../findConsistentOutlierChannels.js";
import {
  connectToDatabase,
  disconnectFromDatabase,
  getDb,
} from "../../../services/database.service.js";
import { NicheAnalyzerService } from "../../../services/nicheAnalyzer.service.js";
import { formatError } from "../../../utils/errorHandler.js";
import { formatSuccess } from "../../../utils/responseFormatter.js";
import { jest } from "@jest/globals"; // Or appropriate Jest import

// Mock dependencies
jest.mock("../../../services/database.service.js");
jest.mock("../../../services/nicheAnalyzer.service.js");
jest.mock("../../../utils/errorHandler.js");
jest.mock("../../../utils/responseFormatter.js");

describe("findConsistentOutlierChannelsHandler", () => {
  // Mock implementations for convenience (can be moved to a beforeEach if shared)
  const mockConnectToDatabase = connectToDatabase as jest.Mock;
  const mockGetDb = getDb as jest.Mock;
  const mockDisconnectFromDatabase = disconnectFromDatabase as jest.Mock;
  const mockFormatSuccess = formatSuccess as jest.Mock;
  const mockFormatError = formatError as jest.Mock;
  // It's NicheAnalyzerService itself that's mocked, so we access the prototype for the method
  const mockFindConsistentOutlierChannels = NicheAnalyzerService.prototype
    .findConsistentOutlierChannels as jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Default mock implementations for success cases
    mockConnectToDatabase.mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({}); // Mock DB object
    mockDisconnectFromDatabase.mockResolvedValue(undefined);
    mockFormatSuccess.mockImplementation((data) => ({ success: true, data }));
    mockFormatError.mockImplementation((error) => ({
      success: false,
      error: error.message,
    }));
    mockFindConsistentOutlierChannels.mockResolvedValue({ items: ["result1"] });
  });

  test("Test 1.1: Standard Successful Run", async () => {
    const validParams = { query: "test query" };
    const mockSearchResults = { items: ["result1"] };
    const mockFormattedSuccess = { success: true, data: mockSearchResults };

    mockFindConsistentOutlierChannels.mockResolvedValue(mockSearchResults);
    mockFormatSuccess.mockReturnValue(mockFormattedSuccess);

    const result = await findConsistentOutlierChannelsHandler(validParams);

    expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
    expect(mockGetDb).toHaveBeenCalledTimes(1);
    expect(NicheAnalyzerService).toHaveBeenCalledTimes(1); // Checks constructor call
    expect(mockFindConsistentOutlierChannels).toHaveBeenCalledTimes(1);
    // Check params, including defaults from schema
    expect(mockFindConsistentOutlierChannels).toHaveBeenCalledWith({
      query: "test query",
      channelAge: "NEW",
      consistencyLevel: "HIGH",
      outlierMagnitude: "STANDARD",
      maxResults: 10,
    });
    expect(mockFormatSuccess).toHaveBeenCalledTimes(1);
    expect(mockFormatSuccess).toHaveBeenCalledWith(mockSearchResults);
    expect(mockFormatError).not.toHaveBeenCalled();
    expect(mockDisconnectFromDatabase).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockFormattedSuccess);
  });

  test("Test 2.1: Invalid Input Data (missing query)", async () => {
    const invalidParams = { channelAge: "NEW" }; // Missing 'query'
    const mockFormattedError = {
      success: false,
      error: "Input validation failed",
    };

    // Mock formatError to return a specific structure for this test
    mockFormatError.mockReturnValue(mockFormattedError);

    // Suppress console.error for this test as Zod errors are expected
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await findConsistentOutlierChannelsHandler(
      invalidParams as any
    ); // Use 'as any' to bypass TS type checking for the test

    expect(mockFindConsistentOutlierChannels).not.toHaveBeenCalled();
    expect(mockFormatError).toHaveBeenCalledTimes(1);
    // We can check the error passed to formatError for more specific Zod error details if needed
    // For example: expect(mockFormatError.mock.calls[0][0]).toBeInstanceOf(z.ZodError);
    expect(mockDisconnectFromDatabase).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockFormattedError);

    consoleErrorSpy.mockRestore(); // Restore console.error
  });

  test("Test 2.1a: Invalid Input Data (maxResults not a number)", async () => {
    const invalidParams = { query: "test", maxResults: "not-a-number" };
    const mockFormattedError = {
      success: false,
      error: "Input validation failed",
    };

    mockFormatError.mockReturnValue(mockFormattedError);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await findConsistentOutlierChannelsHandler(
      invalidParams as any
    );

    expect(mockFindConsistentOutlierChannels).not.toHaveBeenCalled();
    expect(mockFormatError).toHaveBeenCalledTimes(1);
    expect(mockDisconnectFromDatabase).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockFormattedError);

    consoleErrorSpy.mockRestore();
  });

  test("Test 3.1: Database Connection Failure", async () => {
    const validParams = { query: "test query" };
    const dbConnectionError = new Error("DB Connection Failed");
    const mockFormattedError = {
      success: false,
      error: dbConnectionError.message,
    };

    mockConnectToDatabase.mockRejectedValue(dbConnectionError);
    mockFormatError.mockReturnValue(mockFormattedError);

    const result = await findConsistentOutlierChannelsHandler(validParams);

    expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
    expect(mockGetDb).not.toHaveBeenCalled();
    expect(mockFindConsistentOutlierChannels).not.toHaveBeenCalled();
    expect(mockFormatSuccess).not.toHaveBeenCalled();
    expect(mockFormatError).toHaveBeenCalledTimes(1);
    expect(mockFormatError).toHaveBeenCalledWith(dbConnectionError);
    expect(mockDisconnectFromDatabase).toHaveBeenCalledTimes(1); // Still called in finally
    expect(result).toEqual(mockFormattedError);
  });

  test("Test 3.2: Core Analysis Logic Failure", async () => {
    const validParams = { query: "test query" };
    const analysisError = new Error("Analysis Failed");
    const mockFormattedError = { success: false, error: analysisError.message };

    mockFindConsistentOutlierChannels.mockRejectedValue(analysisError);
    mockFormatError.mockReturnValue(mockFormattedError);

    const result = await findConsistentOutlierChannelsHandler(validParams);

    expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
    expect(mockGetDb).toHaveBeenCalledTimes(1);
    expect(NicheAnalyzerService).toHaveBeenCalledTimes(1);
    expect(mockFindConsistentOutlierChannels).toHaveBeenCalledTimes(1);
    expect(mockFindConsistentOutlierChannels).toHaveBeenCalledWith({
      query: "test query",
      channelAge: "NEW",
      consistencyLevel: "HIGH",
      outlierMagnitude: "STANDARD",
      maxResults: 10,
    });
    expect(mockFormatSuccess).not.toHaveBeenCalled();
    expect(mockFormatError).toHaveBeenCalledTimes(1);
    expect(mockFormatError).toHaveBeenCalledWith(analysisError);
    expect(mockDisconnectFromDatabase).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockFormattedError);
  });

  test("Test 4.1: Database Disconnect Failure", async () => {
    const validParams = { query: "test query" };
    const mockSearchResults = { items: ["result1"] };
    const mockFormattedSuccess = { success: true, data: mockSearchResults };
    const disconnectError = new Error("DB Disconnect Failed");

    // Setup for a successful main execution path
    mockFindConsistentOutlierChannels.mockResolvedValue(mockSearchResults);
    mockFormatSuccess.mockReturnValue(mockFormattedSuccess);

    // Make disconnectFromDatabase throw an error
    mockDisconnectFromDatabase.mockRejectedValue(disconnectError);

    // Spy on console.error
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await findConsistentOutlierChannelsHandler(validParams);

    // Check main workflow completion
    expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
    expect(mockGetDb).toHaveBeenCalledTimes(1);
    expect(mockFindConsistentOutlierChannels).toHaveBeenCalledTimes(1);
    expect(mockFormatSuccess).toHaveBeenCalledTimes(1);
    expect(mockFormatSuccess).toHaveBeenCalledWith(mockSearchResults);
    expect(mockFormatError).not.toHaveBeenCalled(); // Ensure no primary error was formatted

    // Check disconnect behavior
    expect(mockDisconnectFromDatabase).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to disconnect from MongoDB:",
      disconnectError
    );

    // Crucially, the result should be the successful one
    expect(result).toEqual(mockFormattedSuccess);

    // Restore console.error spy
    consoleErrorSpy.mockRestore();
  });
});
