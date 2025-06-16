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
import type { CacheService } from "../services/cache.service.js"; // Re-adding as it's used in handlers
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
import type { FindConsistentOutlierChannelsOptions } from "../types/analyzer.types.js";
import type { ZodRawShape } from "zod";

export interface ToolDefinition<TParams = unknown> {
  config: {
    name: string;
    description: string;
    inputSchema: ZodRawShape;
  };
  handler:
    | ((
        params: TParams,
        youtubeService: YoutubeService,
        cacheService: CacheService
      ) => Promise<CallToolResult>)
    | ((
        params: TParams,
        youtubeService: YoutubeService
      ) => Promise<CallToolResult>)
    | ((params: TParams) => Promise<CallToolResult>);
}

export function allTools(container: IServiceContainer): ToolDefinition[] {
  const { youtubeService, cacheService } = container;

  const toolDefinitions: ToolDefinition<any>[] = [
    // Video tools
    {
      config: getVideoDetailsConfig,
      handler: (params: VideoDetailsParams) =>
        getVideoDetailsHandler(params, youtubeService, cacheService),
    } as ToolDefinition<VideoDetailsParams>,
    {
      config: searchVideosConfig,
      handler: (params: SearchParams) =>
        searchVideosHandler(params, youtubeService, cacheService),
    } as ToolDefinition<SearchParams>,
    {
      config: getTranscriptsConfig,
      handler: (params: TranscriptsParams) =>
        getTranscriptsHandler(params, youtubeService),
    } as ToolDefinition<TranscriptsParams>,
    // Channel tools
    {
      config: getChannelStatisticsConfig,
      handler: (params: ChannelStatisticsParams) =>
        getChannelStatisticsHandler(params, youtubeService),
    } as ToolDefinition<ChannelStatisticsParams>,
    {
      config: getChannelTopVideosConfig,
      handler: (params: ChannelParams) =>
        getChannelTopVideosHandler(params, youtubeService, cacheService),
    } as ToolDefinition<ChannelParams>,
    // General tools
    {
      config: getTrendingVideosConfig,
      handler: (params: TrendingParams) =>
        getTrendingVideosHandler(params, youtubeService),
    } as ToolDefinition<TrendingParams>,
    {
      config: getVideoCategoriesConfig,
      handler: (params: VideoCategoriesParams) =>
        getVideoCategoriesHandler(params, youtubeService, cacheService),
    } as ToolDefinition<VideoCategoriesParams>,
  ];

  // Add feature-flagged tools conditionally
  if (isEnabled("toolFindConsistentOutlierChannels")) {
    toolDefinitions.push({
      config: findConsistentOutlierChannelsConfig,
      handler: (params: FindConsistentOutlierChannelsOptions) =>
        findConsistentOutlierChannelsHandler(params),
    } as ToolDefinition<FindConsistentOutlierChannelsOptions>);
  }

  return toolDefinitions;
}
