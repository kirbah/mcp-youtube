import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IServiceContainer } from "../container.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import z from "zod";
import { formatError } from "../utils/errorHandler.js";

// Import all tool classes
import { GetVideoDetailsTool } from "./video/getVideoDetails.js";
import { SearchVideosTool } from "./video/searchVideos.js";
import { GetTranscriptsTool } from "./video/getTranscripts.js";
import { GetVideoCommentsTool } from "./video/getVideoComments.js";
import { GetChannelStatisticsTool } from "./channel/getChannelStatistics.js";
import { GetChannelTopVideosTool } from "./channel/getChannelTopVideos.js";
import { GetTrendingVideosTool } from "./general/getTrendingVideos.js";
import { GetVideoCategoriesTool } from "./general/getVideoCategories.js";
import { FindConsistentOutlierChannelsTool } from "./general/findConsistentOutlierChannels.js";

// 1. Maintain a list of Constructors
const TOOL_CLASSES = [
  GetVideoDetailsTool,
  SearchVideosTool,
  GetTranscriptsTool,
  GetVideoCommentsTool,
  GetChannelStatisticsTool,
  GetChannelTopVideosTool,
  GetTrendingVideosTool,
  GetVideoCategoriesTool,
];

export function registerTools(server: McpServer, container: IServiceContainer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolsToRegister: Array<new (container: IServiceContainer) => any> = [
    ...TOOL_CLASSES,
  ];

  if (process.env.MDB_MCP_CONNECTION_STRING) {
    toolsToRegister.push(FindConsistentOutlierChannelsTool);
  }

  for (const ToolClass of toolsToRegister) {
    // Instantiate with DI container
    const toolInstance = new ToolClass(container);

    const humanReadableTitle = toolInstance.name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str: string) => str.toUpperCase());

    // Register with MCP Server
    server.registerTool(
      toolInstance.name,
      {
        description: toolInstance.description,
        inputSchema: toolInstance.schema,
        annotations: {
          title: humanReadableTitle,
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      (async (
        args: z.infer<typeof toolInstance.schema>
      ): Promise<CallToolResult> => {
        try {
          return await toolInstance.execute(args);
        } catch (err) {
          return formatError(err);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
    );
  }
}
