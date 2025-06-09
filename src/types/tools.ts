export interface VideoDetailsParams {
  videoIds: string[];
}

export interface SearchParams {
  query: string;
  maxResults?: number;
  order?: "relevance" | "date" | "viewCount";
  type?: "video" | "channel";
  channelId?: string;
  videoDuration?: "any" | "short" | "medium" | "long";
  publishedAfter?: string;
  recency?:
    | "any"
    | "pastHour"
    | "pastDay"
    | "pastWeek"
    | "pastMonth"
    | "pastQuarter"
    | "pastYear";
  regionCode?: string;
}

export interface TranscriptsParams {
  videoIds: string[];
  lang?: string;
}

export interface ChannelParams {
  channelId: string;
  maxResults?: number;
  includeTags?: boolean;
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
