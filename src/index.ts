#!/usr/bin/env node

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { allTools } from "./tools/index.js";
import { initializeContainer } from "./container.js";
import { disconnectFromDatabase } from "./services/database.service.js";
import pkg from "../package.json" with { type: "json" };

// Parse command line arguments
const args = process.argv.slice(2);
const transportMode =
  args.includes("--stdio") || process.env.MCP_TRANSPORT === "stdio"
    ? "stdio"
    : "http";

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
  process.env.YOUTUBE_API_KEY = config.youtubeApiKey;
  if (
    config.mdbMcpConnectionString &&
    config.mdbMcpConnectionString.startsWith("mongodb")
  ) {
    process.env.MDB_MCP_CONNECTION_STRING = config.mdbMcpConnectionString;
  }

  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY is not set.");
  }

  const container = initializeContainer();
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

// 3. Create the `main` function for backward-compatible STDIO execution.
// This function handles the full lifecycle for STDIO only.
async function main() {
  const server = createServer({
    config: {
      youtubeApiKey: process.env.YOUTUBE_API_KEY!,
      mdbMcpConnectionString: process.env.MDB_MCP_CONNECTION_STRING!,
    },
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`YouTube MCP server (v${pkg.version}) running in stdio mode.`);

  // Graceful shutdown handlers for STDIO mode (e.g., Ctrl+C)
  const cleanup = async () => {
    console.error("Shutting down STDIO server...");
    await disconnectFromDatabase();
    console.error("Database disconnected. Exiting.");
    process.exit(0);
  };

  process.on("SIGINT", () => void cleanup());
  process.on("SIGTERM", () => void cleanup());
}

if (transportMode === "stdio") {
  // By default, the server starts with stdio transport
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
