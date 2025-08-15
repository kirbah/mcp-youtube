#!/usr/bin/env node

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { allTools } from "./tools/index.js";
import { initializeContainer } from "./container.js";
import { disconnectFromDatabase } from "./services/database.service.js";
import pkg from "../package.json" with { type: "json" };

// Environment variable validation
if (!process.env.YOUTUBE_API_KEY) {
  console.error("Error: YOUTUBE_API_KEY environment variable is not set.");
  process.exit(1);
}

async function main() {
  const container = await initializeContainer();

  // Create MCP server
  const server = new McpServer({
    name: "YouTube",
    version: pkg.version,
  });

  // Register all tools
  allTools(container).forEach(({ config, handler }) => {
    // This now works perfectly, because the `handler` from `allTools`
    // is a simple function that matches the expected signature.
    server.tool(
      config.name,
      config.description,
      config.inputSchema.shape,
      handler
    );
  });

  // Start sending and receiving messages via stdin/stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`YouTube MCP server (v${pkg.version}) has started.`); // Optional: log version
}

void main().catch((err) => {
  console.error("Error occurred during server execution:", err);
  void disconnectFromDatabase().finally(() => process.exit(1));
});

// Graceful shutdown handler
const cleanup = async () => {
  console.error("Shutting down server...");
  await disconnectFromDatabase();
  console.error("Database disconnected. Exiting.");
  process.exit(0);
};

process.on("SIGINT", () => {
  void cleanup();
}); // Catches Ctrl+C
process.on("SIGTERM", () => {
  void cleanup();
}); // Catches kill signals
