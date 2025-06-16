// src/container.ts
import "dotenv/config";
import { Db } from "mongodb";
import {
  connectToDatabase,
  disconnectFromDatabase,
  getDb,
} from "./services/database.service.js";
import { CacheService } from "./services/cache.service.js";
import { YoutubeService } from "./services/youtube.service.js";

export interface IServiceContainer {
  cacheService?: CacheService;
  youtubeService: YoutubeService;
}

let container: IServiceContainer | null = null;

export async function initializeContainer(): Promise<IServiceContainer> {
  if (container) return container;

  const youtubeService = new YoutubeService();
  let cacheService: CacheService | undefined;

  if (process.env.MDB_MCP_CONNECTION_STRING) {
    try {
      await connectToDatabase();
      const db = getDb();
      cacheService = new CacheService(db);
      console.error("INFO: Database and Cache services enabled.");
    } catch (e) {
      console.error(
        "WARN: Database connection failed. Cache is disabled.",
        e instanceof Error ? e.message : String(e)
      );
    }
  } else {
    console.error(
      "INFO: MDB_MCP_CONNECTION_STRING not set. Cache is disabled."
    );
  }

  container = { cacheService, youtubeService };
  return container;
}
