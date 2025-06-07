import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const formatSuccess = (
  data: any
): CallToolResult => {
  return {
    success: true,
    data: data, // The actual data, not stringified
  };
};

export const formatVideoMap = (
  videoIds: string[],
  results: any[]
): Record<string, any> => {
  return videoIds.reduce((acc, videoId, index) => {
    acc[videoId] = results[index];
    return acc;
  }, {} as Record<string, any>);
};

export const formatChannelMap = (
  channelIds: string[],
  results: any[]
): Record<string, any> => {
  return channelIds.reduce((acc, channelId, index) => {
    acc[channelId] = results[index];
    return acc;
  }, {} as Record<string, any>);
};
