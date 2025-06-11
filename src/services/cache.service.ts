import { Db } from "mongodb";
import { createHash } from "crypto";
import { youtube_v3 } from "googleapis";
import { ChannelCache, SearchCache } from "./analysis/analysis.types.js";

export class CacheService {
  private db: Db;
  private readonly SEARCH_CACHE_COLLECTION = "search_cache";
  private readonly CHANNELS_CACHE_COLLECTION = "channels_cache";
  private readonly CACHE_TTL_HOURS = 24;

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
  ): Promise<any[] | null> {
    try {
      const collection = this.db.collection(this.SEARCH_CACHE_COLLECTION);
      const searchParamsHash = this.generateSearchParamsHash(searchParams);

      const cachedResult = (await collection.findOne({
        searchParamsHash,
        expiresAt: { $gt: new Date() },
      })) as SearchCache | null;

      if (cachedResult) {
        return cachedResult.results;
      }

      return null;
    } catch (error: any) {
      console.error(`Cache retrieval failed: ${error.message}`);
      return null;
    }
  }

  async storeCachedSearchResults(
    searchParams: youtube_v3.Params$Resource$Search$List,
    results: any[]
  ): Promise<void> {
    try {
      const collection = this.db.collection(this.SEARCH_CACHE_COLLECTION);
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
        { searchParamsHash },
        { $set: cacheDocument },
        { upsert: true }
      );
    } catch (error: any) {
      console.error(`Cache storage failed: ${error.message}`);
    }
  }

  async findChannelsByIds(ids: string[]): Promise<ChannelCache[]> {
    try {
      const collection = this.db.collection(this.CHANNELS_CACHE_COLLECTION);
      const cachedChannels = await collection
        .find({ _id: { $in: ids } } as any)
        .toArray();
      return cachedChannels as unknown as ChannelCache[];
    } catch (error: any) {
      console.error(`Failed to find channels by IDs: ${error.message}`);
      throw error;
    }
  }

  async updateChannel(
    channelId: string,
    updates: Partial<ChannelCache>
  ): Promise<void> {
    try {
      const collection = this.db.collection(this.CHANNELS_CACHE_COLLECTION);
      await collection.updateOne(
        { _id: channelId } as any,
        { $set: updates },
        { upsert: true }
      );
    } catch (error: any) {
      console.error(
        `Failed to update channel cache for ${channelId}: ${error.message}`
      );
      throw error;
    }
  }

  async updateChannelWithHistory(
    channelId: string,
    latestAnalysis: ChannelCache["latestAnalysis"],
    status: ChannelCache["status"],
    historyEntry: ChannelCache["analysisHistory"][0]
  ): Promise<void> {
    try {
      const collection = this.db.collection(this.CHANNELS_CACHE_COLLECTION);
      await collection.updateOne({ _id: channelId } as any, {
        $set: {
          latestAnalysis: latestAnalysis,
          status: status,
        },
        $push: {
          analysisHistory: historyEntry,
        } as any,
      });
    } catch (error: any) {
      console.error(
        `Failed to update channel with history for ${channelId}: ${error.message}`
      );
      throw error;
    }
  }
}
