#!/usr/bin/env node

import "dotenv/config";
import { YoutubeService } from "./services/youtube.service.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { allTools } from "./tools/index.js";

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
  const youtubeService = new YoutubeService();

  // Create MCP server
  const server = new McpServer({
    name: "YouTube",
    version: pkg.version, // <-- Use the version from package.json
  });

  // Register all tools
  allTools.forEach(({ config, handler }) => {
    server.tool(
      config.name,
      config.description,
      config.inputSchema,
      (params: any) => {
        // Check if handler expects videoManager parameter
        if (handler.length === 2) {
          // Handler expects (params, youtubeService)
          return (
            handler as (
              params: any,
              youtubeService: YoutubeService
            ) => Promise<any>
          )(params, youtubeService);
        } else {
          // Handler expects only (params)
          return (handler as (params: any) => Promise<any>)(params);
        }
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
  process.exit(1);
});
