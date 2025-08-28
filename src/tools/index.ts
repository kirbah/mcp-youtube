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
import { isEnabled } from "../utils/featureFlags.js";

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

export interface ToolDefinition<TParams = unknown> {
  config: {
    name: string;
    description: string;
    inputSchema: z.ZodObject<any>;
  };
  handler: (params: TParams) => Promise<CallToolResult>;
}

export function allTools(container: IServiceContainer): ToolDefinition[] {
  // We no longer get 'db' from the container.
  const { youtubeService, transcriptService } = container;

  // 2. Define all tools, wrapping the original handlers with the dependencies they need.
  const toolDefinitions: ToolDefinition<any>[] = [
    // Video tools
    {
      config: getVideoDetailsConfig,
      handler: (params: VideoDetailsParams) =>
        getVideoDetailsHandler(params, youtubeService),
    },
    {
      config: searchVideosConfig,
      handler: (params: SearchParams) =>
        searchVideosHandler(params, youtubeService),
    },
    {
      config: getTranscriptsConfig,
      // This handler is now simple: (params) => ..., because transcriptService is "baked in".
      handler: (params: TranscriptsParams) =>
        getTranscriptsHandler(params, transcriptService),
    },
    // Channel tools
    {
      config: getChannelStatisticsConfig,
      handler: (params: ChannelStatisticsParams) =>
        getChannelStatisticsHandler(params, youtubeService),
    },
    {
      config: getChannelTopVideosConfig,
      handler: (params: ChannelParams) =>
        getChannelTopVideosHandler(params, youtubeService),
    },
    // General tools
    {
      config: getTrendingVideosConfig,
      handler: (params: TrendingParams) =>
        getTrendingVideosHandler(params, youtubeService),
    },
    {
      config: getVideoCategoriesConfig,
      handler: (params: VideoCategoriesParams) =>
        getVideoCategoriesHandler(params, youtubeService),
    },
  ];

  // Add feature-flagged tools conditionally
  if (isEnabled("toolFindConsistentOutlierChannels")) {
    toolDefinitions.push({
      config: findConsistentOutlierChannelsConfig,
      // The handler no longer needs the 'db' object passed to it.
      handler: (params: FindConsistentOutlierChannelsParams) =>
        findConsistentOutlierChannelsHandler(params, youtubeService),
    });
  }

  return toolDefinitions;
}
