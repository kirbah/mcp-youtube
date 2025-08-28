import "dotenv/config";
import { CacheService } from "./services/cache.service.js";
import { YoutubeService } from "./services/youtube.service.js";
import { TranscriptService } from "./services/transcript.service.js";

export interface IServiceContainer {
  cacheService: CacheService;
  youtubeService: YoutubeService;
  transcriptService: TranscriptService;
}

let container: IServiceContainer | null = null;

export function initializeContainer(): IServiceContainer {
  if (container) return container;

  const cacheService = new CacheService();
  const youtubeService = new YoutubeService(cacheService);
  const transcriptService = new TranscriptService(cacheService);

  container = { cacheService, youtubeService, transcriptService };
  return container;
}
