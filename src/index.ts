#!/usr/bin/env node

import "dotenv/config";
import { VideoManagement } from "./functions/videos.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { allTools } from "./tools/index.js";

// Environment variable validation
if (!process.env.YOUTUBE_API_KEY) {
  console.error("Error: YOUTUBE_API_KEY environment variable is not set.");
  process.exit(1);
}

async function main() {
  const videoManager = new VideoManagement();

  // Create MCP server
  const server = new McpServer({
    name: "YouTube",
    version: "1.0.0",
  });

  // Register all tools
  allTools.forEach(({ config, handler }) => {
    server.tool(
      config.name,
      config.description,
      config.inputSchema,
      (params: any) => handler(params, videoManager)
    );
  });

  // Start sending and receiving messages via stdin/stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("YouTube MCP server has started.");
}

main().catch((err) => {
  console.error("Error occurred during server execution:", err);
  process.exit(1);
});
