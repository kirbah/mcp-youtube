import {
  FindConsistentOutlierChannelsOptions,
  NicheAnalysisOutput,
} from "../types/analyzer.types.js";
import { CacheService } from "./cache.service.js";
import { VideoManagement } from "../functions/videos.js";
import { executeInitialCandidateSearch } from "./analysis/phase1-candidate-search.js";
import { executeChannelPreFiltering } from "./analysis/phase2-channel-filtering.js";
import { executeDeepConsistencyAnalysis } from "./analysis/phase3-deep-analysis.js";
import { formatAndRankAnalysisResults } from "./analysis/phase4-ranking-formatting.js";
export class NicheAnalyzerService {
  private cacheService: CacheService;
  private videoManagement: VideoManagement;

  constructor(cacheService: CacheService, videoManagement: VideoManagement) {
    this.cacheService = cacheService;
    this.videoManagement = videoManagement;
  }

  async findConsistentOutlierChannels(
    options: FindConsistentOutlierChannelsOptions
  ): Promise<NicheAnalysisOutput> {
    try {
      // 1. Reset the counter at the very beginning of the run!
      this.videoManagement.resetApiCreditsUsed();
      // Phase 1: Initial candidate search
      const candidateChannelIds = await executeInitialCandidateSearch(
        options,
        this.cacheService,
        this.videoManagement
      );

      // Phase 2: Pre-filtering & cache logic
      const prospects = await executeChannelPreFiltering(
        candidateChannelIds,
        options,
        this.cacheService,
        this.videoManagement
      );

      // Phase 3: Deep consistency analysis
      const { results: analysisResults, quotaExceeded } =
        await executeDeepConsistencyAnalysis(
          prospects,
          options,
          this.cacheService,
          this.videoManagement
        );

      // Phase 4: Filter, Sort, Slice & Format
      const finalOutput = formatAndRankAnalysisResults(
        analysisResults, // Pass the raw ChannelCache[] directly
        options, // Pass the full options object
        quotaExceeded
      );

      // Update summary with actual counts and cost
      // 3. Get the final, accurate cost at the very end.
      const actualApiCreditsUsed = this.videoManagement.getApiCreditsUsed();

      // 4. Build the final response object with the REAL number.
      finalOutput.summary.candidatesFound = candidateChannelIds.length;
      finalOutput.summary.candidatesAnalyzed = analysisResults.length; // Use analysisResults.length for analyzed candidates
      finalOutput.summary.apiCreditsUsed = actualApiCreditsUsed; // Use the accurate value

      return finalOutput;
    } catch (error: any) {
      throw new Error(
        `Failed to find consistent outlier channels: ${error.message}`
      );
    }
  }
}
