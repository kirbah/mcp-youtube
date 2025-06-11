import { z } from "zod";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { regionCodeSchema } from "../../utils/validation.js";
import {
  connectToDatabase,
  disconnectFromDatabase,
  getDb,
} from "../../services/database.service.js";
import { CacheService } from "../../services/cache.service.js";
import { NicheAnalyzerService } from "../../services/nicheAnalyzer.service.js";
import { VideoManagement } from "../../functions/videos.js";
import type { FindConsistentOutlierChannelsOptions } from "../../types/analyzer.types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const findConsistentOutlierChannelsSchema = z.object({
  query: z.string().min(1, "Query is required"),
  channelAge: z.enum(["NEW", "ESTABLISHED"]).default("NEW"),
  consistencyLevel: z.enum(["MODERATE", "HIGH"]).default("HIGH"),
  outlierMagnitude: z.enum(["STANDARD", "STRONG"]).default("STANDARD"),
  videoCategoryId: z.string().optional(),
  regionCode: regionCodeSchema.optional(),
  maxResults: z.number().int().min(1).max(50).default(10),
});

export const findConsistentOutlierChannelsConfig = {
  name: "findConsistentOutlierChannels",
  description:
    "A powerful, high-cost discovery tool. It finds emerging channels that show consistent, high-performance relative to their size within a specific topic and timeframe.",
  inputSchema: {
    query: z
      .string()
      .min(1)
      .describe(
        "Required. The core topic or niche to investigate (e.g., 'stoic philosophy', 'AI history explainers')."
      ),
    channelAge: z
      .enum(["NEW", "ESTABLISHED"])
      .optional()
      .describe(
        "Filters for channels by their age, which also sets the time window for video performance analysis. 'NEW' is for emerging trends (under 6 months). 'ESTABLISHED' is for channels with a longer track record (6-24 months)."
      ),
    consistencyLevel: z
      .enum(["MODERATE", "HIGH"])
      .optional()
      .describe(
        "Defines how consistently a channel's recent videos must outperform its subscriber count. 'MODERATE' requires 30% of videos to be outliers, 'HIGH' requires 50%."
      ),
    outlierMagnitude: z
      .enum(["STANDARD", "STRONG"])
      .optional()
      .describe(
        "Defines how strong a video's view count must be relative to the channel's subscriber count to be considered an 'outlier'. 'STANDARD' requires views > 1x subscribers. 'STRONG' requires views > 3x subscribers."
      ),
    videoCategoryId: z
      .string()
      .optional()
      .describe(
        "Optional. A YouTube video category ID to focus the search (e.g., '27' for Education, '20' for Gaming). This greatly improves the relevance of the search."
      ),
    regionCode: z
      .string()
      .length(2)
      .optional()
      .describe(
        "Optional. A 2-letter country code (e.g., 'US', 'DE') to focus the search on a specific regional audience."
      ),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe(
        "The maximum number of top-performing channels to return in the final, sorted list. Defaults to 10."
      ),
  },
};

export const findConsistentOutlierChannelsHandler = async (
  params: FindConsistentOutlierChannelsOptions
): Promise<CallToolResult> => {
  try {
    await connectToDatabase();
    const db = getDb();
    const cacheService = new CacheService(db);
    const videoManagement = new VideoManagement();
    const nicheAnalyzer = new NicheAnalyzerService(
      cacheService,
      videoManagement
    );

    const validatedParams = findConsistentOutlierChannelsSchema.parse(params);

    const searchResults = await nicheAnalyzer.findConsistentOutlierChannels(
      validatedParams
    );

    return formatSuccess(searchResults);
  } catch (error: any) {
    return formatError(error);
  } finally {
    try {
      await disconnectFromDatabase();
    } catch (disconnectError) {
      console.error("Failed to disconnect from MongoDB:", disconnectError);
    }
  }
};
