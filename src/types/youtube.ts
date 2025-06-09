export interface LeanVideoDetails {
  id: string | null | undefined;
  title: string | null | undefined;
  description: string | null | undefined;
  channelId: string | null | undefined;
  channelTitle: string | null | undefined;
  publishedAt: string | null | undefined;
  duration: string | null | undefined;
  viewCount: number | null | undefined;
  likeCount: number | null | undefined;
  commentCount: number | null | undefined;
  likeToViewRatio: number | null | undefined;
  commentToViewRatio: number | null | undefined;
  tags?: string[] | null | undefined;
  categoryId: string | null | undefined;
  defaultLanguage: string | null | undefined;
}

export interface LeanChannelTopVideo {
  id: string | null | undefined;
  title: string | null | undefined;
  description: string | null | undefined;
  publishedAt: string | null | undefined;
  duration: string | null | undefined;
  viewCount: number | null | undefined;
  likeCount: number | null | undefined;
  commentCount: number | null | undefined;
  likeToViewRatio: number | null | undefined;
  commentToViewRatio: number | null | undefined;
  tags?: string[] | null | undefined;
  categoryId: string | null | undefined;
  defaultLanguage: string | null | undefined;
}

export interface LeanTrendingVideo {
  id: string | null | undefined;
  title: string | null | undefined;
  channelId: string | null | undefined;
  channelTitle: string | null | undefined;
  publishedAt: string | null | undefined;
  duration: string | null | undefined;
  viewCount: number | null | undefined;
  likeCount: number | null | undefined;
  commentCount: number | null | undefined;
  likeToViewRatio: number | null | undefined;
  commentToViewRatio: number | null | undefined;
}

export interface LeanVideoSearchResult {
  videoId: string | null | undefined;
  title: string | null | undefined;
  descriptionSnippet: string | null | undefined;
  channelId: string | null | undefined;
  channelTitle: string | null | undefined;
  publishedAt: string | null | undefined;
}

export interface LeanChannelStatistics {
  channelId: string | null | undefined;
  title: string | null | undefined;
  subscriberCount: number | null | undefined;
  viewCount: number | null | undefined;
  videoCount: number | null | undefined;
  createdAt: string | null | undefined;
}

export interface VideoInfo {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
    channelId: string;
    channelTitle: string;
    publishedAt: string;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
}

export interface ChannelInfo {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
    customUrl: string;
  };
  statistics: {
    viewCount: string;
    subscriberCount: string;
    videoCount: string;
  };
}

export interface SearchResult {
  id: {
    kind: string;
    videoId: string | null;
    channelId: string | null;
    playlistId: string | null;
  };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
    channelTitle: string;
    publishedAt: string;
  };
}

export interface CommentInfo {
  id: string;
  snippet: {
    topLevelComment: {
      snippet: {
        textDisplay: string;
        authorDisplayName: string;
        authorProfileImageUrl: string;
        likeCount: number;
        publishedAt: string;
      };
    };
    totalReplyCount: number;
  };
}
