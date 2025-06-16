// src/config/cache.config.ts

// All TTL values are in seconds.

const ONE_HOUR = 3600;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;
const ONE_YEAR = 365 * ONE_DAY;

/**
 * Defines the Time-To-Live (TTL) for various types of cached data.
 * This provides a single source of truth for caching policies.
 */
export const CACHE_TTLS = {
  // For data that changes frequently, like trending videos.
  DYNAMIC: ONE_DAY,

  // For standard entity data that can be updated, like video details or search results.
  STANDARD: ONE_WEEK,

  // For semi-static data that changes infrequently, like a channel's top videos.
  SEMI_STATIC: ONE_MONTH,

  // For truly static data that rarely or never changes, like video categories.
  STATIC: ONE_YEAR,
};

/**
 * Defines the collection names used for different types of cached data.
 * This helps in organizing data within MongoDB.
 */
export const CACHE_COLLECTIONS = {
  VIDEO_DETAILS: "video_details",
  CHANNEL_TOP_VIDEOS: "channel_top_videos",
  VIDEO_SEARCHES: "video_searches",
  VIDEO_CATEGORIES: "video_categories",
  TRANSCRIPTS: "transcripts",
};
