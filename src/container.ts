import "dotenv/config";
import { Db } from "mongodb";
import { connectToDatabase, getDb } from "./services/database.service.js";
import { CacheService } from "./services/cache.service.js";
import { YoutubeService } from "./services/youtube.service.js";
import { TranscriptService } from "./services/transcript.service.js";

export interface IServiceContainer {
  db: Db;
  cacheService: CacheService;
  youtubeService: YoutubeService;
  transcriptService: TranscriptService;
}

let container: IServiceContainer | null = null;

export async function initializeContainer(): Promise<IServiceContainer> {
  if (container) return container;

  if (!process.env.MDB_MCP_CONNECTION_STRING) {
    throw new Error(
      "MDB_MCP_CONNECTION_STRING is not set. Cannot connect to database."
    );
  }

  await connectToDatabase();
  const db = getDb();
  const cacheService = new CacheService(db);
  const youtubeService = new YoutubeService(cacheService);
  const transcriptService = new TranscriptService(cacheService);

  container = { db, cacheService, youtubeService, transcriptService };
  return container;
}
