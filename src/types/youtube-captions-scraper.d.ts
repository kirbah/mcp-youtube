declare module "youtube-captions-scraper" {
  interface SubtitleOptions {
    videoID: string;
    lang?: string;
  }

  interface SubtitleItem {
    start: number;
    dur: number;
    text: string;
  }

  export function getSubtitles(
    options: SubtitleOptions
  ): Promise<SubtitleItem[]>;
}
