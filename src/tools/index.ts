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

import type { YoutubeService } from "../services/youtube.service.js";
import type { CacheService } from "../services/cache.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { IServiceContainer } from "../container.js";

export interface ToolDefinition {
  config: {
    name: string;
    description: string;
    inputSchema: any;
  };
  handler:
    | ((params: any, videoManager: YoutubeService) => Promise<CallToolResult>)
    | ((params: any) => Promise<CallToolResult>);
}

export function allTools(container: IServiceContainer): ToolDefinition[] {
  const { youtubeService, cacheService } = container;

  const toolDefinitions: ToolDefinition[] = [
    // Video tools
    {
      config: getVideoDetailsConfig,
      handler: (params: any) =>
        getVideoDetailsHandler(params, youtubeService, cacheService),
    },
    {
      config: searchVideosConfig,
      handler: (params: any) => searchVideosHandler(params, youtubeService),
    },
    {
      config: getTranscriptsConfig,
      handler: (params: any) => getTranscriptsHandler(params, youtubeService),
    },
    // Channel tools
    {
      config: getChannelStatisticsConfig,
      handler: (params: any) =>
        getChannelStatisticsHandler(params, youtubeService),
    },
    {
      config: getChannelTopVideosConfig,
      handler: (params: any) =>
        getChannelTopVideosHandler(params, youtubeService, cacheService),
    },
    // General tools
    {
      config: getTrendingVideosConfig,
      handler: (params: any) =>
        getTrendingVideosHandler(params, youtubeService),
    },
    {
      config: getVideoCategoriesConfig,
      handler: (params: any) =>
        getVideoCategoriesHandler(params, youtubeService),
    },
  ];

  // Add feature-flagged tools conditionally
  if (isEnabled("toolFindConsistentOutlierChannels")) {
    toolDefinitions.push({
      config: findConsistentOutlierChannelsConfig,
      handler: findConsistentOutlierChannelsHandler,
    });
  }

  return toolDefinitions;
}
