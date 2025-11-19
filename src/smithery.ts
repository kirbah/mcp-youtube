#!/usr/bin/env node

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { allTools } from "./tools/index.js";
import { initializeContainer } from "./container.js";
import pkg from "../package.json" with { type: "json" };

// 1. Define and export the configuration schema for Smithery.
export const configSchema = z.object({
  youtubeApiKey: z
    .string()
    .describe("YouTube Data API key for accessing the YouTube API."),
  mdbMcpConnectionString: z
    .string()
    .optional()
    .describe("MongoDB connection string to cache the data."),
});

// 2. Create the `createServer` function for Smithery's HTTP runtime.
// It sets up the server but does NOT handle transport or shutdown.
export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  const container = initializeContainer({
    apiKey: config.youtubeApiKey,
    mdbMcpConnectionString: config.mdbMcpConnectionString,
  });

  const server = new McpServer({
    name: "YouTube",
    version: pkg.version,
  });

  allTools(container).forEach(({ config, handler }) => {
    server.tool(
      config.name,
      config.description,
      config.inputSchema.shape,
      handler
    );
  });

  // Return the inner server object. No event listeners are needed here.
  return server.server;
}
