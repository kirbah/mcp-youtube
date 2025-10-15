import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const formatSuccess = <T>(data: T): CallToolResult => {
  return {
    success: true,
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
};

export const formatVideoMap = <T>(
  videoIds: string[],
  results: T[]
): Record<string, T> => {
  return videoIds.reduce(
    (acc, videoId, index) => {
      acc[videoId] = results[index];
      return acc;
    },
    {} as Record<string, T>
  );
};

export const formatChannelMap = <T>(
  channelIds: string[],
  results: T[]
): Record<string, T> => {
  return channelIds.reduce(
    (acc, channelId, index) => {
      acc[channelId] = results[index];
      return acc;
    },
    {} as Record<string, T>
  );
};
