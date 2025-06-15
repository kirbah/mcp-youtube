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
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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

export function getAllTools(): ToolDefinition[] {
  const baseTools: ToolDefinition[] = [
    // Video tools
    {
      config: getVideoDetailsConfig,
      handler: getVideoDetailsHandler,
    },
    {
      config: searchVideosConfig,
      handler: searchVideosHandler,
    },
    {
      config: getTranscriptsConfig,
      handler: getTranscriptsHandler,
    },
    // Channel tools
    {
      config: getChannelStatisticsConfig,
      handler: getChannelStatisticsHandler,
    },
    {
      config: getChannelTopVideosConfig,
      handler: getChannelTopVideosHandler,
    },
    // General tools
    {
      config: getTrendingVideosConfig,
      handler: getTrendingVideosHandler,
    },
    {
      config: getVideoCategoriesConfig,
      handler: getVideoCategoriesHandler,
    },
  ];

  // Add feature-flagged tools conditionally
  if (isEnabled("toolFindConsistentOutlierChannels")) {
    baseTools.push({
      config: findConsistentOutlierChannelsConfig,
      handler: findConsistentOutlierChannelsHandler,
    });
  }

  return baseTools;
}

// For backward compatibility, export the tools as a getter
export const allTools: ToolDefinition[] = getAllTools();
