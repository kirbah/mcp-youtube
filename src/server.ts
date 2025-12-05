import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pkg from "../package.json" with { type: "json" };
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { allTools } from "./tools/index.js";
import { IServiceContainer } from "./container.js";
import { registerPrompts } from "./prompts/index.js";

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

  // --- Centralized helper to register tools with annotations ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function registerTool<T extends z.ZodObject<any>>(
    config: { name: string; description: string; inputSchema: T },
    handler: (args: z.infer<T>) => Promise<CallToolResult>
  ) {
    const humanReadableTitle = config.name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());

    server.registerTool(
      config.name,
      {
        description: config.description,
        inputSchema: config.inputSchema,
        annotations: {
          title: humanReadableTitle,
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      (async (args: z.infer<T>): Promise<CallToolResult> => {
        try {
          return await handler(args);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true,
          };
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
    );
  }

  allTools(container).forEach(({ config, handler }) =>
    registerTool(config, handler)
  );

  registerPrompts(server, container);

  return server;
}
