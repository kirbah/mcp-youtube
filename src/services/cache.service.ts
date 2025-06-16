import { Db, Collection, Filter, UpdateFilter } from "mongodb";
import { createHash } from "crypto";
import { youtube_v3 } from "googleapis";
import {
  ChannelCache,
  SearchCache,
  VideoListCache,
} from "./analysis/analysis.types.js";

/**
 * A generic structure for entries in our new caching collections.
 * The data type is templated to allow storing any kind of object.
 * @template T The type of the data being stored.
 */
interface GenericCacheEntry<T> {
  _id: string; // The cache key (can be a direct ID like a videoId, or a hash).
  data: T;
  expiresAt: Date;
  params?: object; // Optional: The arguments used to generate this cache entry (for hashed keys).
}

export class CacheService {
  private db: Db;
  private readonly CACHE_COLLECTION_PREFIX = "yt_cache_"; // A prefix for all new generic cache collections.

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * The core generic caching method. It attempts to retrieve data from the cache using a key.
   * If the data is not found or is expired, it executes the provided `operation` function,
   * stores the result back in the cache, and then returns it.
   *
   * @template T The type of data being cached.
   * @param key The unique key for this cache entry (e.g., a 'videoId' or a generated hash).
   * @param operation An async function that returns the fresh data (type T) to be cached on a miss.
   * @param ttlSeconds The Time-To-Live for this cache entry, in seconds.
   * @param collectionName A descriptive name for the MongoDB collection where this data will be stored (e.g., "video_details").
   * @returns A promise that resolves to the data, either from the cache or freshly generated.
   */
  public async getOrSet<T>(
    key: string,
    operation: () => Promise<T>,
    ttlSeconds: number,
    collectionName: string,
    params?: object
  ): Promise<T> {
    const collection: Collection<GenericCacheEntry<T>> = this.db.collection(
      `${this.CACHE_COLLECTION_PREFIX}${collectionName}`
    );

    const cachedResult = await collection.findOne({
      _id: key,
      expiresAt: { $gt: new Date() },
    });

    if (cachedResult) {
      // Data found in cache and it's not expired. Return it.
      return cachedResult.data;
    }

    // Data not in cache or expired. Execute the operation to get fresh data.
    const freshData = await operation();

    // Only store the data if it's not null or undefined to avoid caching failed operations.
    if (freshData !== null && freshData !== undefined) {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      // Build the cache document, including params if they were provided.
      const cacheDocument: GenericCacheEntry<T> = {
        _id: key,
        data: freshData,
        expiresAt,
      };
      if (params) {
        cacheDocument.params = params;
      }

      await collection.updateOne(
        { _id: key },
        { $set: cacheDocument },
        { upsert: true }
      );
    }

    return freshData;
  }

  /**
   * A helper utility to create a consistent, unique hash key from a function's name and its arguments.
   * This is ideal for caching the results of complex queries (like video searches) where the
   * combination of all parameters determines the result.
   *
   * @param operationName A unique name for the operation being cached (e.g., "searchVideos").
   * @param args An object containing all the arguments for the operation.
   * @returns A cryptographic SHA256 hash string to be used as a cache key.
   */
  public createOperationKey(operationName: string, args: object): string {
    // Sort keys of the arguments object to ensure that {a:1, b:2} and {b:2, a:1} produce the same hash.
    const sortedArgs = Object.keys(args)
      .sort()
      .reduce(
        (obj, key) => {
          const value = args[key as keyof typeof args];
          // Exclude undefined values from the key to prevent ambiguity.
          if (value !== undefined) {
            obj[key as keyof typeof args] = value;
          }
          return obj;
        },
        {} as typeof args
      );

    const keyString = `${operationName}:${JSON.stringify(sortedArgs)}`;
    return createHash("sha256").update(keyString).digest("hex");
  }

  // This code remains to ensure the NicheAnalyzerService continues to function.

  private readonly SEARCH_CACHE_COLLECTION = "search_cache";
  private readonly CHANNELS_CACHE_COLLECTION = "channels_cache";
  private readonly VIDEO_LIST_CACHE_COLLECTION = "video_list_cache";
  private readonly CACHE_TTL_HOURS = 24;
  private readonly VIDEO_LIST_CACHE_TTL_HOURS = 72;

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
