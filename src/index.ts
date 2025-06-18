#!/usr/bin/env node

import "dotenv/config";
import { YoutubeService } from "./services/youtube.service.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Db } from "mongodb";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { allTools } from "./tools/index.js";
import { initializeContainer } from "./container.js";
import { disconnectFromDatabase } from "./services/database.service.js";
// --- Import package.json ---
// For ES Modules, you need to use an assertion for JSON modules
// and ensure your tsconfig allows it.
import pkg from "../package.json" with { type: "json" };

// Environment variable validation
if (!process.env.YOUTUBE_API_KEY) {
  console.error("Error: YOUTUBE_API_KEY environment variable is not set.");
  process.exit(1);
}

async function main() {
  const container = await initializeContainer();
  const { youtubeService, db } = container; // Destructure youtubeService and db

  // Create MCP server
  const server = new McpServer({
    name: "YouTube",
    version: pkg.version, // <-- Use the version from package.json
  });

  // Register all tools
  allTools(container).forEach(({ config, handler }) => {
    server.tool(
      config.name,
      config.description,
      config.inputSchema,
      (params: any) => {
        // All handlers now consistently expect (params, youtubeService, databaseService)
        // The handler itself will destructure the parameters it needs.
        return (
          handler as (
            params: any,
            youtubeService: YoutubeService,
            db: Db
          ) => Promise<any>
        )(params, youtubeService, db);
      }
    );
  });

  // Start sending and receiving messages via stdin/stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`YouTube MCP server (v${pkg.version}) has started.`); // Optional: log version
}

main().catch((err) => {
  console.error("Error occurred during server execution:", err);
  disconnectFromDatabase().finally(() => process.exit(1));
});

// Graceful shutdown handler
const cleanup = async () => {
  console.error("Shutting down server...");
  await disconnectFromDatabase();
  console.error("Database disconnected. Exiting.");
  process.exit(0);
};

process.on("SIGINT", cleanup); // Catches Ctrl+C
process.on("SIGTERM", cleanup); // Catches kill signals
