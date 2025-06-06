export interface VideoDetailsParams {
  videoIds: string[];
}

export interface SearchParams {
  query: string;
  maxResults?: number;
}

export interface TranscriptsParams {
  videoIds: string[];
  lang?: string;
}

export interface ChannelParams {
  channelId: string;
  maxResults?: number;
}

export interface ChannelStatisticsParams {
  channelIds: string[];
}

export interface TrendingParams {
  regionCode?: string;
  categoryId?: string;
  maxResults?: number;
}

export interface VideoCategoriesParams {
  regionCode?: string;
}
