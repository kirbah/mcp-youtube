import createServer, { configSchema } from "../index";
import { z } from "zod";
import * as databaseService from "../services/database.service"; // Import the module to mock

// Mock the initializeDatabase function
jest.mock("../services/database.service", () => ({
  ...jest.requireActual("../services/database.service"), // Keep actual implementations for other exports
  initializeDatabase: jest.fn(), // Mock initializeDatabase
}));

describe("createServer", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear any previous calls to the mock
    (databaseService.initializeDatabase as jest.Mock).mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should call initializeDatabase with the correct connection string if provided", () => {
    const mockConnectionString = "mongodb://test";
    const config: z.infer<typeof configSchema> = {
      youtubeApiKey: "test-key",
      mdbMcpConnectionString: mockConnectionString,
    };
    createServer({ config });
    expect(databaseService.initializeDatabase).toHaveBeenCalledTimes(1);
    expect(databaseService.initializeDatabase).toHaveBeenCalledWith(
      mockConnectionString
    );
  });

  it("should not call initializeDatabase if mdbMcpConnectionString is not provided", () => {
    const config: z.infer<typeof configSchema> = {
      youtubeApiKey: "test-key",
      // mdbMcpConnectionString is optional and not provided
    };
    createServer({ config });
    expect(databaseService.initializeDatabase).not.toHaveBeenCalled();
  });

  it("should not call initializeDatabase if mdbMcpConnectionString is an empty string", () => {
    const config: z.infer<typeof configSchema> = {
      youtubeApiKey: "test-key",
      mdbMcpConnectionString: "",
    };
    createServer({ config });
    expect(databaseService.initializeDatabase).not.toHaveBeenCalled();
  });
});
