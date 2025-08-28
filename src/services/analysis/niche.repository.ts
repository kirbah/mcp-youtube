import { Collection, Filter, UpdateFilter } from "mongodb";
import type { ChannelCache } from "../../types/niche.types.js";
import { getDb } from "../database.service.js"; // Import the lazy loader

export class NicheRepository {
  private readonly CHANNELS_CACHE_COLLECTION = "analysis_channels";

  async findChannelsByIds(ids: string[]): Promise<ChannelCache[]> {
    try {
      // Lazily get the database connection.
      const db = await getDb();
      const collection: Collection<ChannelCache> = db.collection(
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
      // Lazily get the database connection.
      const db = await getDb();
      const collection: Collection<ChannelCache> = db.collection(
        this.CHANNELS_CACHE_COLLECTION
      );
      await collection.updateOne(
        { _id: channelId } as Filter<ChannelCache>,
        updates,
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
