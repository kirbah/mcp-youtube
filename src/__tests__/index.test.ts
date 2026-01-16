import { runServer } from "../index";
import { configSchema } from "../server";
import { z } from "zod";
import * as databaseService from "../services/database.service"; // Import the module to mock
import * as container from "../container";

// Mock the initializeDatabase function
jest.mock("../services/database.service", () => ({
  ...jest.requireActual("../services/database.service"), // Keep actual implementations for other exports
  initializeDatabase: jest.fn(), // Mock initializeDatabase
  disconnectFromDatabase: jest.fn(),
}));

jest.mock("../container", () => ({
  ...jest.requireActual("../container"),
  initializeContainer: jest.fn().mockReturnValue({
    // provide a mock container that can be used in tests
    youtubeService: {},
    nicheAnalyzerService: {},
    cacheService: {},
    transcriptService: {},
    databaseService: {
      initializeDatabase: jest.fn(),
      getDb: jest.fn(),
      disconnect: jest.fn(),
    },
  }),
}));

describe("runServer", () => {
  beforeEach(() => {
    // Clear any previous calls to the mock
    (databaseService.initializeDatabase as jest.Mock).mockClear();
    (container.initializeContainer as jest.Mock).mockClear();
  });

  it("should call initializeContainer with the correct connection string if provided", async () => {
    const mockConnectionString = "mongodb://test";
    const config: z.infer<typeof configSchema> = {
      youtubeApiKey: "test-key",
      mdbMcpConnectionString: mockConnectionString,
    };
    await runServer(config);
    expect(container.initializeContainer).toHaveBeenCalledTimes(1);
    expect(container.initializeContainer).toHaveBeenCalledWith({
      apiKey: config.youtubeApiKey,
      mdbMcpConnectionString: config.mdbMcpConnectionString,
    });
  });

  it("should call initializeContainer without mdbMcpConnectionString if it is not provided", async () => {
    const config: z.infer<typeof configSchema> = {
      youtubeApiKey: "test-key",
      // mdbMcpConnectionString is optional and not provided
    };
    await runServer(config);
    expect(container.initializeContainer).toHaveBeenCalledWith({
      apiKey: config.youtubeApiKey,
      mdbMcpConnectionString: undefined,
    });
  });

  it("should call initializeContainer with an empty mdbMcpConnectionString if it is an empty string", async () => {
    const config: z.infer<typeof configSchema> = {
      youtubeApiKey: "test-key",
      mdbMcpConnectionString: "",
    };
    await runServer(config);
    expect(container.initializeContainer).toHaveBeenCalledWith({
      apiKey: config.youtubeApiKey,
      mdbMcpConnectionString: "",
    });
  });
});
