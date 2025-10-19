import { NicheAnalyzerService } from "../nicheAnalyzer.service";
import { CacheService } from "../cache.service";
import { YoutubeService } from "../../services/youtube.service";
import { NicheRepository } from "../analysis/niche.repository"; // Import NicheRepository
import { executeInitialCandidateSearch } from "../analysis/phase1-candidate-search";
import { executeChannelPreFiltering } from "../analysis/phase2-channel-filtering";
import { executeDeepConsistencyAnalysis } from "../analysis/phase3-deep-analysis";
import { formatAndRankAnalysisResults } from "../analysis/phase4-ranking-formatting";
import {
  FindConsistentOutlierChannelsOptions,
  NicheAnalysisOutput,
} from "../../types/analyzer.types";
import { mocked } from "../../__tests__/utils/mocks";

// Mock dependencies
jest.mock("../cache.service");
jest.mock("../../services/youtube.service");
jest.mock("../analysis/niche.repository"); // Mock NicheRepository
jest.mock("../analysis/phase1-candidate-search");
jest.mock("../analysis/phase2-channel-filtering");
jest.mock("../analysis/phase3-deep-analysis");
jest.mock("../analysis/phase4-ranking-formatting");

describe("NicheAnalyzerService", () => {
  let nicheAnalyzerService: NicheAnalyzerService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockVideoManagement: jest.Mocked<YoutubeService>;
  let mockNicheRepository: jest.Mocked<NicheRepository>; // Declare mockNicheRepository

  // Mocked phase functions
  const mockExecuteInitialCandidateSearch =
    executeInitialCandidateSearch as jest.Mock;
  const mockExecuteChannelPreFiltering =
    executeChannelPreFiltering as jest.Mock;
  const mockExecuteDeepConsistencyAnalysis =
    executeDeepConsistencyAnalysis as jest.Mock;
  const mockFormatAndRankAnalysisResults =
    formatAndRankAnalysisResults as jest.Mock;

  const DUMMY_API_KEY = "dummy-api-key"; // Define dummy API key

  beforeEach(() => {
    // Reset mocks before each test
    mockCacheService = mocked(new CacheService(null as any)); // Explicitly cast
    mockVideoManagement = mocked(
      new YoutubeService(DUMMY_API_KEY, mockCacheService)
    ); // Explicitly cast

    // Provide mock implementations for VideoManagement methods
    mockVideoManagement.resetApiCreditsUsed = jest.fn();
    mockVideoManagement.getApiCreditsUsed = jest.fn().mockReturnValue(0);
    mockVideoManagement.searchVideos = jest.fn();
    mockVideoManagement.batchFetchChannelStatistics = jest.fn();
    mockVideoManagement.fetchChannelRecentTopVideos = jest.fn();
    mockVideoManagement.getVideo = jest.fn();
    // mockVideoManagement.getTranscript = jest.fn(); // Removed as it's not a public method
    mockVideoManagement.getChannelStatistics = jest.fn();
    mockVideoManagement.getChannelTopVideos = jest.fn();
    mockVideoManagement.getTrendingVideos = jest.fn();
    mockVideoManagement.getVideoCategories = jest.fn();

    mockNicheRepository = mocked(new NicheRepository()); // Corrected constructor call and explicitly cast

    nicheAnalyzerService = new NicheAnalyzerService(
      mockVideoManagement,
      mockNicheRepository
    );

    // Reset phase function mocks
    mockExecuteInitialCandidateSearch.mockReset();
    mockExecuteChannelPreFiltering.mockReset();
    mockExecuteDeepConsistencyAnalysis.mockReset();
    mockFormatAndRankAnalysisResults.mockReset();
  });

  it("should execute a successful end-to-end analysis run, calling phases in order and passing data", async () => {
    const options: FindConsistentOutlierChannelsOptions = {
      query: "test query",
      channelAge: "NEW",
      consistencyLevel: "MODERATE",
      outlierMagnitude: "STANDARD",
      maxResults: 10,
    };

    const phase1Output = ["channel1", "channel2"];
    const phase2Output = ["channel1"]; // channel2 filtered out
    const phase3Output = {
      results: [{ _id: "channel1" /* other channel data */ } as any],
      quotaExceeded: false,
    };

    mockExecuteInitialCandidateSearch.mockResolvedValue(phase1Output);
    mockExecuteChannelPreFiltering.mockResolvedValue(phase2Output);
    mockExecuteDeepConsistencyAnalysis.mockResolvedValue(phase3Output);
    // IMPORTANT: The mockReturnValue for mockFormatAndRankAnalysisResults will be set inline where it's used
    // to ensure the summary object is correctly formed with up-to-date data.
    // mockFormatAndRankAnalysisResults.mockReturnValue(phase4Output); // This line is removed
    mockVideoManagement.getApiCreditsUsed.mockReturnValue(100); // Ensure this is mocked for summary

    // Define the expected phase4Output structure here, based on phase3Output and other mocks
    const expectedPhase4Output: NicheAnalysisOutput = {
      status: "COMPLETED_SUCCESSFULLY",
      summary: {
        candidatesFound: phase1Output.length,
        candidatesAnalyzed: phase3Output.results.length,
        apiCreditsUsed: 100, // This will be asserted against mockVideoManagement.getApiCreditsUsed
      },
      results: [{ channelId: "channel1" /* other result data */ } as any], // Assuming this structure
    };
    mockFormatAndRankAnalysisResults.mockReturnValue(expectedPhase4Output);

    const result =
      await nicheAnalyzerService.findConsistentOutlierChannels(options);

    // Check order of calls and data passing
    expect(mockExecuteInitialCandidateSearch).toHaveBeenCalledWith(
      options,
      mockVideoManagement
    );
    expect(mockExecuteChannelPreFiltering).toHaveBeenCalledWith(
      phase1Output,
      options,
      mockVideoManagement,
      mockNicheRepository
    );
    expect(mockExecuteDeepConsistencyAnalysis).toHaveBeenCalledWith(
      phase2Output,
      options,
      mockVideoManagement,
      mockNicheRepository
    );
    expect(mockFormatAndRankAnalysisResults).toHaveBeenCalledWith(
      phase3Output.results,
      options,
      phase3Output.quotaExceeded
    );

    // Check final output
    expect(result).toEqual(expectedPhase4Output); // Compare with the locally defined expected output
    expect(result.summary.candidatesFound).toBe(phase1Output.length);
    expect(result.summary.candidatesAnalyzed).toBe(phase3Output.results.length);
    expect(result.summary.apiCreditsUsed).toBe(100);
  });

  it("should correctly track and report API credit usage", async () => {
    const options: FindConsistentOutlierChannelsOptions = {
      query: "api test",
      channelAge: "ESTABLISHED",
      consistencyLevel: "HIGH",
      outlierMagnitude: "STRONG",
      maxResults: 5,
    };

    const expectedApiCredits = 123;

    // Mock phase functions to allow execution flow
    mockExecuteInitialCandidateSearch.mockResolvedValue([]);
    mockExecuteChannelPreFiltering.mockResolvedValue([]);
    mockExecuteDeepConsistencyAnalysis.mockResolvedValue({
      results: [],
      quotaExceeded: false,
    });
    mockFormatAndRankAnalysisResults.mockImplementation(() => {
      // Return a basic structure for phase 4, the important part is the summary update later
      return {
        status: "COMPLETED_SUCCESSFULLY",
        summary: {
          candidatesFound: 0,
          candidatesAnalyzed: 0,
          apiCreditsUsed: 0,
        }, // Placeholder, will be overridden
        results: [],
      };
    });
    mockVideoManagement.getApiCreditsUsed.mockReturnValue(expectedApiCredits);

    const result =
      await nicheAnalyzerService.findConsistentOutlierChannels(options);

    expect(mockVideoManagement.resetApiCreditsUsed).toHaveBeenCalledTimes(1);
    // Ensure reset is called before other VideoManagement potential calls within phases (though phases are mocked here)
    // A more robust way if phases weren't fully mocked would be to check order of calls.
    // For this test, checking times is sufficient given the mocks.

    expect(mockVideoManagement.getApiCreditsUsed).toHaveBeenCalledTimes(1);
    expect(result.summary.apiCreditsUsed).toBe(expectedApiCredits);
  });

  it("should stop and re-throw an error descriptively if a middle phase fails", async () => {
    const options: FindConsistentOutlierChannelsOptions = {
      query: "error test",
      channelAge: "NEW",
      consistencyLevel: "MODERATE",
      outlierMagnitude: "STANDARD",
      maxResults: 10,
    };
    const originalErrorMessage = "Phase 2 exploded!";
    const expectedErrorMessage = `Failed to find consistent outlier channels: ${originalErrorMessage}`;

    mockExecuteInitialCandidateSearch.mockResolvedValue([
      "channel1",
      "channel2",
    ]);
    mockExecuteChannelPreFiltering.mockRejectedValue(
      new Error(originalErrorMessage)
    );

    await expect(
      nicheAnalyzerService.findConsistentOutlierChannels(options)
    ).rejects.toThrow(expectedErrorMessage);

    // Ensure Phase 1 was called
    expect(mockExecuteInitialCandidateSearch).toHaveBeenCalledWith(
      options,
      mockVideoManagement
    );
    // Ensure Phase 2 (the failing one) was called
    expect(mockExecuteChannelPreFiltering).toHaveBeenCalledWith(
      ["channel1", "channel2"],
      options,
      mockVideoManagement,
      mockNicheRepository
    );

    // Ensure subsequent phases were NOT called
    expect(mockExecuteDeepConsistencyAnalysis).not.toHaveBeenCalled();
    expect(mockFormatAndRankAnalysisResults).not.toHaveBeenCalled();
  });
});
