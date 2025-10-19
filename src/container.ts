import "dotenv/config";
import { CacheService } from "./services/cache.service.js";
import { YoutubeService } from "./services/youtube.service.js";
import { TranscriptService } from "./services/transcript.service.js";
import { initializeDatabase } from "./services/database.service.js";

export interface IServiceContainer {
  cacheService: CacheService;
  youtubeService: YoutubeService;
  transcriptService: TranscriptService;
}

let container: IServiceContainer | null = null;

export function initializeContainer({
  apiKey,
  mdbMcpConnectionString,
}: {
  apiKey: string;
  mdbMcpConnectionString?: string;
}): IServiceContainer {
  if (mdbMcpConnectionString) {
    initializeDatabase(mdbMcpConnectionString);
  }

  const cacheService = new CacheService(mdbMcpConnectionString);
  const youtubeService = new YoutubeService(apiKey, cacheService);
  const transcriptService = new TranscriptService(cacheService);

  container = { cacheService, youtubeService, transcriptService };
  return container;
}
