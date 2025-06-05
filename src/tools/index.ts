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
  getRelatedVideosConfig,
  getRelatedVideosHandler,
} from "./video/getRelatedVideos.js";
import {
  getVideoEngagementRatioConfig,
  getVideoEngagementRatioHandler,
} from "./video/getVideoEngagementRatio.js";
import {
  compareVideosConfig,
  compareVideosHandler,
} from "./video/compareVideos.js";

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

import type { VideoManagement } from "../functions/videos.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface ToolDefinition {
  config: {
    name: string;
    description: string;
    inputSchema: any;
  };
  handler: (
    params: any,
    videoManager: VideoManagement
  ) => Promise<CallToolResult>;
}

export const allTools: ToolDefinition[] = [
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
  {
    config: getRelatedVideosConfig,
    handler: getRelatedVideosHandler,
  },
  {
    config: getVideoEngagementRatioConfig,
    handler: getVideoEngagementRatioHandler,
  },
  {
    config: compareVideosConfig,
    handler: compareVideosHandler,
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
];
