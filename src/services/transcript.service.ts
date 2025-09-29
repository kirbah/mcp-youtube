import { getSubtitles, Subtitle } from "youtube-caption-extractor";
import { CacheService } from "./cache.service.js";
import { CACHE_TTLS, CACHE_COLLECTIONS } from "../config/cache.config.js";

export class TranscriptService {
  private cacheService: CacheService;

  constructor(cacheService: CacheService) {
    this.cacheService = cacheService;
  }

  public async getTranscriptSegments(
    videoId: string,
    lang: string = "en",
    format: "full_text" | "key_segments" = "key_segments"
  ): Promise<object | null> {
    const rawSubtitles = await this.fetchAndCacheRawTranscript(videoId, lang);

    if (!rawSubtitles || rawSubtitles.length === 0) {
      return null;
    }

    if (format === "full_text") {
      return {
        transcript: rawSubtitles.map((sub) => sub.text).join(" "),
      };
    }

    const hook = this.extractHook(rawSubtitles);
    const outro = this.extractOutro(rawSubtitles);
    return { hook, outro };
  }

  private async fetchAndCacheRawTranscript(
    videoId: string,
    lang: string = "en"
  ): Promise<Subtitle[]> {
    const cacheKey = this.cacheService.createOperationKey("getTranscript", {
      videoId,
      lang,
    });

    const operation = async (): Promise<Subtitle[]> => {
      try {
        const transcript = await getSubtitles({
          videoID: videoId,
          lang: lang,
        });
        return transcript;
      } catch (_error) {
        return [];
      }
    };

    return this.cacheService.getOrSet<Subtitle[]>(
      cacheKey,
      operation,
      CACHE_TTLS.STATIC,
      CACHE_COLLECTIONS.TRANSCRIPTS,
      { videoId, lang }
    );
  }

  private extractHook(subtitles: Subtitle[]): string {
    const HOOK_DURATION_SECONDS = 40;
    let hookText = "";
    for (const sub of subtitles) {
      const startTime = parseFloat(sub.start);
      if (startTime < HOOK_DURATION_SECONDS) {
        hookText += sub.text + " ";
      } else {
        break;
      }
    }
    return hookText.trim();
  }

  private extractOutro(subtitles: Subtitle[]): string {
    if (subtitles.length === 0) return "";

    const OUTRO_DURATION_SECONDS = 30;
    const lastTimestamp = parseFloat(subtitles[subtitles.length - 1].start);
    const outroStartTime = Math.max(0, lastTimestamp - OUTRO_DURATION_SECONDS);

    const startIndex = subtitles.findIndex(
      (sub) => parseFloat(sub.start) >= outroStartTime
    );

    if (startIndex === -1) {
      return subtitles
        .map((s) => s.text)
        .join(" ")
        .trim();
    }

    return subtitles
      .slice(startIndex)
      .map((s) => s.text)
      .join(" ")
      .trim();
  }
}
