export const formatSuccess = (
  data: any
): { content: Array<{ type: "text"; text: string }> } => {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
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
