#!/usr/bin/env node

import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { configSchema } from "./server.js";
import { initializeContainer } from "./container.js";
import { disconnectFromDatabase } from "./services/database.service.js";
import pkg from "../package.json" with { type: "json" };
import { createMcpServer } from "./server.js";

export async function runServer(config: z.infer<typeof configSchema>) {
  const container = initializeContainer({
    apiKey: config.youtubeApiKey,
    mdbMcpConnectionString: config.mdbMcpConnectionString,
  });

  const server = createMcpServer(container);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`YouTube MCP server (v${pkg.version}) running in stdio mode.`);

  return server;
}

async function main() {
  await runServer({
    youtubeApiKey: process.env.YOUTUBE_API_KEY!,
    mdbMcpConnectionString: process.env.MDB_MCP_CONNECTION_STRING,
  });

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

// By default, the server starts with stdio transport
if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
