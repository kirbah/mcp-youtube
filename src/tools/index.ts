// Video tools
import {
  getVideoDetailsConfig,
  getVideoDetailsHandler,
} from "./video/getVideoDetails.js";
import {
  searchVideosConfig,
  searchVideosHandler,
} from "./video/searchVideos.js";
import {
  getTranscriptsConfig,
  getTranscriptsHandler,
} from "./video/getTranscripts.js";
import {
  getVideoCommentsConfig,
  getVideoCommentsHandler,
  getVideoCommentsSchema, // Import the schema
} from "./video/getVideoComments.js";

// Channel tools
import {
  getChannelStatisticsConfig,
  getChannelStatisticsHandler,
} from "./channel/getChannelStatistics.js";
import {
  getChannelTopVideosConfig,
  getChannelTopVideosHandler,
} from "./channel/getChannelTopVideos.js";

// General tools
import {
  getTrendingVideosConfig,
  getTrendingVideosHandler,
} from "./general/getTrendingVideos.js";
import {
  getVideoCategoriesConfig,
  getVideoCategoriesHandler,
} from "./general/getVideoCategories.js";
import {
  findConsistentOutlierChannelsConfig,
  findConsistentOutlierChannelsHandler,
} from "./general/findConsistentOutlierChannels.js";

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { IServiceContainer } from "../container.js";
import type {
  VideoDetailsParams,
  SearchParams,
  TranscriptsParams,
  ChannelStatisticsParams,
  ChannelParams,
  TrendingParams,
  VideoCategoriesParams,
  FindConsistentOutlierChannelsParams,
} from "../types/tools.js";
import { z } from "zod";

export interface ToolDefinition {
  config: {
    name: string;
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputSchema: z.ZodObject<any>;
  };
  handler: (params: Record<string, unknown>) => Promise<CallToolResult>;
}

export function allTools(container: IServiceContainer): ToolDefinition[] {
  // We no longer get 'db' from the container.
  const { youtubeService, transcriptService } = container;

  // 2. Define all tools, wrapping the original handlers with the dependencies they need.
  const toolDefinitions: ToolDefinition[] = [
    // Video tools
    {
      config: getVideoDetailsConfig,
      // WRAP the handler and CAST the params
      handler: (params) =>
        getVideoDetailsHandler(
          params as unknown as VideoDetailsParams,
          youtubeService
        ),
    },
    {
      config: searchVideosConfig,
      handler: (params) =>
        searchVideosHandler(params as unknown as SearchParams, youtubeService),
    },
    {
      config: getTranscriptsConfig,
      handler: (params) =>
        getTranscriptsHandler(
          params as unknown as TranscriptsParams,
          transcriptService
        ),
    },
    {
      config: getVideoCommentsConfig,
      handler: (params) =>
        getVideoCommentsHandler(
          params as unknown as z.infer<typeof getVideoCommentsSchema>,
          youtubeService
        ),
    },
    // Channel tools
    {
      config: getChannelStatisticsConfig,
      handler: (params) =>
        getChannelStatisticsHandler(
          params as unknown as ChannelStatisticsParams,
          youtubeService
        ),
    },
    {
      config: getChannelTopVideosConfig,
      handler: (params) =>
        getChannelTopVideosHandler(
          params as unknown as ChannelParams,
          youtubeService
        ),
    },
    // General tools
    {
      config: getTrendingVideosConfig,
      handler: (params) =>
        getTrendingVideosHandler(
          params as unknown as TrendingParams,
          youtubeService
        ),
    },
    {
      config: getVideoCategoriesConfig,
      handler: (params) =>
        getVideoCategoriesHandler(
          params as unknown as VideoCategoriesParams,
          youtubeService
        ),
    },
  ];

  if (process.env.MDB_MCP_CONNECTION_STRING) {
    toolDefinitions.push({
      config: findConsistentOutlierChannelsConfig,
      handler: (params) =>
        findConsistentOutlierChannelsHandler(
          params as unknown as FindConsistentOutlierChannelsParams,
          youtubeService
        ),
    });
  }

  return toolDefinitions;
}
