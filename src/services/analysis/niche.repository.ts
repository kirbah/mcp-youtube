import { Collection, Filter, UpdateFilter } from "mongodb";
import type { ChannelCache } from "../../types/niche.types.js";
import { getDb } from "../database.service.js"; // Import the lazy loader

export class NicheRepository {
  private readonly CHANNELS_CACHE_COLLECTION = "analysis_channels";

  async findChannelsByIds(ids: string[]): Promise<ChannelCache[]> {
    // Lazily get the database connection.
    const db = await getDb();
    const collection: Collection<ChannelCache> = db.collection(
      this.CHANNELS_CACHE_COLLECTION
    );
    const cachedChannels = await collection
      .find({ _id: { $in: ids } } as Filter<ChannelCache>)
      .toArray();
    return cachedChannels as ChannelCache[];
  }

  async updateChannel(
    channelId: string,
    updates: UpdateFilter<ChannelCache>
  ): Promise<void> {
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
  }
}
