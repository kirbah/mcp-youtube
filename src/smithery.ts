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
    apiKey: config.youtubeApiKey || "",
    mdbMcpConnectionString: config.mdbMcpConnectionString,
  });

  const server = new McpServer({
    name: "YouTube",
    version: pkg.version,
  });

  // Helper function to preserve the generic type link between schema and handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function registerTool<T extends z.ZodObject<any>>(
    config: { name: string; description: string; inputSchema: T },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: z.infer<T>) => Promise<any>
  ) {
    server.tool(
      config.name,
      config.description,
      config.inputSchema.shape,
      async (args: z.infer<T>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return await handler(args);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true,
          };
        }
      }
    );
  }

  allTools(container).forEach(({ config, handler }) => {
    registerTool(config, handler);
  });

  // Return the inner server object. No event listeners are needed here.
  return server.server;
}
