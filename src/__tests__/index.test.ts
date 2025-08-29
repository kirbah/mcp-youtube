import createServer, { configSchema } from "../index";
import { z } from "zod";

describe("createServer", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.MDB_MCP_CONNECTION_STRING;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should set MDB_MCP_CONNECTION_STRING if it is a valid mongodb connection string", () => {
    const config: z.infer<typeof configSchema> = {
      youtubeApiKey: "test-key",
      mdbMcpConnectionString: "mongodb://test",
    };
    createServer({ config });
    expect(process.env.MDB_MCP_CONNECTION_STRING).toBe("mongodb://test");
  });

  it("should not set MDB_MCP_CONNECTION_STRING if it is not a valid mongodb connection string", () => {
    const config: z.infer<typeof configSchema> = {
      youtubeApiKey: "test-key",
      mdbMcpConnectionString: "not-a-mongodb-string",
    };
    createServer({ config });
    expect(process.env.MDB_MCP_CONNECTION_STRING).toBeUndefined();
  });

  it("should not set MDB_MCP_CONNECTION_STRING if it is an empty string", () => {
    const config: z.infer<typeof configSchema> = {
      youtubeApiKey: "test-key",
      mdbMcpConnectionString: "",
    };
    createServer({ config });
    expect(process.env.MDB_MCP_CONNECTION_STRING).toBeUndefined();
  });
});
