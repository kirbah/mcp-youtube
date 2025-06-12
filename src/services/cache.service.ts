import { Db, Collection, Filter, UpdateFilter } from "mongodb";
import { createHash } from "crypto";
import { youtube_v3 } from "googleapis";
import {
  ChannelCache,
  SearchCache,
  VideoListCache,
  HistoricalAnalysisEntry,
  LatestAnalysis,
} from "./analysis/analysis.types.js";

export class CacheService {
  private db: Db;
  private readonly SEARCH_CACHE_COLLECTION = "search_cache";
  private readonly CHANNELS_CACHE_COLLECTION = "channels_cache";
  private readonly VIDEO_LIST_CACHE_COLLECTION = "video_list_cache"; // New collection for video lists
  private readonly CACHE_TTL_HOURS = 24; // This is for search_cache, not video_list_cache
  private readonly VIDEO_LIST_CACHE_TTL_HOURS = 72; // 72 hours (3 days)

  constructor(db: Db) {
    this.db = db;
  }

  private generateSearchParamsHash(
    searchParams: youtube_v3.Params$Resource$Search$List
  ): string {
    const paramsString = JSON.stringify(
      searchParams,
      Object.keys(searchParams).sort()
    );
    return createHash("sha256").update(paramsString).digest("hex");
  }

  async getCachedSearchResults(
    searchParams: youtube_v3.Params$Resource$Search$List
  ): Promise<youtube_v3.Schema$SearchResult[] | null> {
    try {
      const collection: Collection<SearchCache> = this.db.collection(
        this.SEARCH_CACHE_COLLECTION
      );
      const searchParamsHash = this.generateSearchParamsHash(searchParams);

      const cachedResult = await collection.findOne({
        searchParamsHash,
        expiresAt: { $gt: new Date() },
      });

      if (cachedResult) {
        return cachedResult.results as youtube_v3.Schema$SearchResult[];
      }

      return null;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Cache retrieval failed: ${error.message}`);
      } else {
        console.error(`Cache retrieval failed: ${String(error)}`);
      }
      return null;
    }
  }

  async storeCachedSearchResults(
    searchParams: youtube_v3.Params$Resource$Search$List,
    results: youtube_v3.Schema$SearchResult[]
  ): Promise<void> {
    try {
      const collection: Collection<SearchCache> = this.db.collection(
        this.SEARCH_CACHE_COLLECTION
      );
      const searchParamsHash = this.generateSearchParamsHash(searchParams);
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + this.CACHE_TTL_HOURS * 60 * 60 * 1000
      );

      const cacheDocument: SearchCache = {
        searchParamsHash,
        searchParams,
        results,
        createdAt: now,
        expiresAt,
      };

      await collection.updateOne(
        { searchParamsHash } as Filter<SearchCache>,
        { $set: cacheDocument },
        { upsert: true }
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Cache storage failed: ${error.message}`);
      } else {
        console.error(`Cache storage failed: ${String(error)}`);
      }
    }
  }

  async getVideoListCache(channelId: string): Promise<VideoListCache | null> {
    try {
      const collection: Collection<VideoListCache> = this.db.collection(
        this.VIDEO_LIST_CACHE_COLLECTION
      );
      const cachedResult = await collection.findOne({ _id: channelId });

      if (cachedResult) {
        const now = new Date();
        const fetchedAt = cachedResult.fetchedAt;
        const expiresAt = new Date(
          fetchedAt.getTime() + this.VIDEO_LIST_CACHE_TTL_HOURS * 60 * 60 * 1000
        );

        if (now < expiresAt) {
          return cachedResult;
        } else {
          // Cache is stale, remove it
          await collection.deleteOne({ _id: channelId });
          return null;
        }
      }
      return null;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(
          `Video list cache retrieval failed for ${channelId}: ${error.message}`
        );
      } else {
        console.error(
          `Video list cache retrieval failed for ${channelId}: ${String(error)}`
        );
      }
      return null;
    }
  }

  async setVideoListCache(
    channelId: string,
    videos: youtube_v3.Schema$Video[]
  ): Promise<void> {
    try {
      const collection: Collection<VideoListCache> = this.db.collection(
        this.VIDEO_LIST_CACHE_COLLECTION
      );
      const now = new Date();

      const cacheDocument: VideoListCache = {
        _id: channelId,
        videos: videos,
        fetchedAt: now,
      };

      await collection.updateOne(
        { _id: channelId } as Filter<VideoListCache>,
        { $set: cacheDocument },
        { upsert: true }
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(
          `Video list cache storage failed for ${channelId}: ${error.message}`
        );
      } else {
        console.error(
          `Video list cache storage failed for ${channelId}: ${String(error)}`
        );
      }
    }
  }

  async findChannelsByIds(ids: string[]): Promise<ChannelCache[]> {
    try {
      const collection: Collection<ChannelCache> = this.db.collection(
        this.CHANNELS_CACHE_COLLECTION
      );
      const cachedChannels = await collection
        .find({ _id: { $in: ids } } as Filter<ChannelCache>)
        .toArray();
      return cachedChannels as ChannelCache[];
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Failed to find channels by IDs: ${error.message}`);
      } else {
        console.error(`Failed to find channels by IDs: ${String(error)}`);
      }
      throw error;
    }
  }

  async updateChannel(
    channelId: string,
    updates: UpdateFilter<ChannelCache>
  ): Promise<void> {
    try {
      const collection: Collection<ChannelCache> = this.db.collection(
        this.CHANNELS_CACHE_COLLECTION
      );
      await collection.updateOne(
        { _id: channelId } as Filter<ChannelCache>,
        updates, // Directly pass the update object
        { upsert: true }
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(
          `Failed to update channel cache for ${channelId}: ${error.message}`
        );
      } else {
        console.error(
          `Failed to update channel cache for ${channelId}: ${String(error)}`
        );
      }
      throw error;
    }
  }
}
