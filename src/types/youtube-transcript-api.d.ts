declare module "youtube-transcript-api" {
  interface TranscriptItem {
    text: string;
    start: number;
    duration: number;
  }

  export class YoutubeTranscript {
    getTranscript(videoId: string): Promise<TranscriptItem[]>;
  }
}
