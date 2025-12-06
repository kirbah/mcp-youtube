import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pkg from "../package.json" with { type: "json" };
import { IServiceContainer } from "./container.js";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";

export const configSchema = z.object({
  youtubeApiKey: z
    .string()
    .describe("YouTube Data API key for accessing the YouTube API."),
  mdbMcpConnectionString: z
    .string()
    .optional()
    .describe("MongoDB connection string to cache the data."),
});

/**
 * Creates and configures a new McpServer instance with all tools registered.
 * This function centralizes server setup to be shared between STDIO and HTTP runtimes.
 * @param container The service container with initialized services.
 * @returns A fully configured McpServer instance.
 */
export function createMcpServer(container: IServiceContainer) {
  const server = new McpServer({
    name: "YouTube",
    version: pkg.version,
  });

  registerTools(server, container);

  registerPrompts(server, container);

  registerResources(server, container);

  return server;
}
