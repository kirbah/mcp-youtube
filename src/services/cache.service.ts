import { Collection } from "mongodb";
import { createHash } from "crypto";
import { omitPaths } from "../utils/objectUtils.js";
import { getDb } from "./database.service.js"; // Import the lazy loader

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
  private readonly CACHE_COLLECTION_PREFIX = "yt_cache_";

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
   * @param params Optional: Parameters used to generate the hashed keys and stored in cache as params.
   * @param pathsToExclude Optional: An array of string paths (e.g., "snippet.thumbnails") to exclude from the cached data.
   * @returns A promise that resolves to the data, either from the cache or freshly generated.
   */
  public async getOrSet<T extends object | null | undefined>(
    key: string,
    operation: () => Promise<T>,
    ttlSeconds: number,
    collectionName: string,
    params?: object,
    pathsToExclude?: string[]
  ): Promise<T> {
    if (!process.env.MDB_MCP_CONNECTION_STRING) {
      // If no DB is configured, bypass caching and execute the operation directly.
      return operation();
    }
    // Lazily get the database connection here, on first use.
    const db = await getDb();
    const collection: Collection<GenericCacheEntry<T>> = db.collection(
      `${this.CACHE_COLLECTION_PREFIX}${collectionName}`
    );

    const cachedResult = await collection.findOne({
      _id: key,
      expiresAt: { $gt: new Date() },
    });

    if (cachedResult) {
      return cachedResult.data;
    }

    const freshData = await operation();

    if (freshData === null || freshData === undefined) {
      return freshData;
    }

    // Use your own utility to create the object that will be cached.
    const dataToCache =
      pathsToExclude && pathsToExclude.length > 0
        ? omitPaths(freshData, pathsToExclude)
        : freshData;

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const cacheDocument: GenericCacheEntry<T> = {
      _id: key,
      data: dataToCache, // Storing the (potentially) smaller object
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

    return dataToCache;
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
}
