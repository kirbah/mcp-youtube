import { MongoClient, Db } from "mongodb";
import { google, youtube_v3 } from "googleapis";

export interface FindConsistentOutlierChannelsOptions {
  query: string;
  channelAge: "NEW" | "ESTABLISHED";
  consistencyLevel: "MODERATE" | "HIGH";
  outlierMagnitude: "STANDARD" | "STRONG";
  videoCategoryId?: string;
  regionCode?: string;
  maxResults: number;
}

export class NicheAnalyzer {
  private youtube: youtube_v3.Youtube;
  private mongoClient: MongoClient;
  private db: Db | null = null;
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly DATABASE_NAME = "youtube_niche_analysis";

  constructor() {
    // Initialize YouTube API client
    this.youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    });

    // Initialize MongoDB client
    const connectionString = process.env.MDB_MCP_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error(
        "MDB_MCP_CONNECTION_STRING environment variable is required"
      );
    }

    this.mongoClient = new MongoClient(connectionString);
  }

  async connect(): Promise<void> {
    try {
      await this.mongoClient.connect();
      this.db = this.mongoClient.db(this.DATABASE_NAME);
    } catch (error: any) {
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.mongoClient.close();
      this.db = null;
    } catch (error: any) {
      throw new Error(`Failed to disconnect from MongoDB: ${error.message}`);
    }
  }

  private ensureConnected(): void {
    if (!this.db) {
      throw new Error(
        "MongoDB connection not established. Call connect() first."
      );
    }
  }

  private calculateChannelAgePublishedAfter(
    channelAge: "NEW" | "ESTABLISHED"
  ): string {
    const now = new Date();
    const monthsToSubtract = channelAge === "NEW" ? 6 : 24;
    const millisecondsToSubtract = monthsToSubtract * 30 * 24 * 60 * 60 * 1000;
    const targetTime = new Date(now.getTime() - millisecondsToSubtract);
    return targetTime.toISOString();
  }

  async findConsistentOutlierChannels({
    query,
    channelAge,
    consistencyLevel,
    outlierMagnitude,
    videoCategoryId,
    regionCode,
    maxResults,
  }: FindConsistentOutlierChannelsOptions) {
    this.ensureConnected();

    try {
      // Calculate publishedAfter based on channelAge
      const publishedAfter = this.calculateChannelAgePublishedAfter(channelAge);

      // Build search parameters
      const searchParams: youtube_v3.Params$Resource$Search$List = {
        q: query,
        publishedAfter: publishedAfter,
        part: ["snippet"],
        type: ["video"],
        order: "relevance",
        maxResults: 50,
      };

      // Add optional parameters if provided
      if (regionCode) {
        searchParams.regionCode = regionCode;
      }

      if (videoCategoryId) {
        searchParams.videoCategoryId = videoCategoryId;
      }

      // Perform the search
      const initialSearchResults = await this.youtube.search.list(searchParams);

      // Return raw search results for now
      // TODO: Implement outlier analysis logic based on consistencyLevel and outlierMagnitude
      // TODO: Store/retrieve channel statistics from MongoDB to avoid recalculation
      return initialSearchResults.data.items || [];
    } catch (error: any) {
      throw new Error(
        `Failed to find consistent outlier channels: ${error.message}`
      );
    }
  }

  // Future method for storing channel statistics in MongoDB
  async storeChannelStatistics(
    channelId: string,
    statistics: any
  ): Promise<void> {
    this.ensureConnected();

    try {
      const collection = this.db!.collection("channel_statistics");
      await collection.updateOne(
        { channelId },
        {
          $set: {
            ...statistics,
            lastUpdated: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (error: any) {
      throw new Error(`Failed to store channel statistics: ${error.message}`);
    }
  }

  // Future method for retrieving channel statistics from MongoDB
  async getChannelStatistics(channelId: string): Promise<any | null> {
    this.ensureConnected();

    try {
      const collection = this.db!.collection("channel_statistics");
      return await collection.findOne({ channelId });
    } catch (error: any) {
      throw new Error(
        `Failed to retrieve channel statistics: ${error.message}`
      );
    }
  }
}
