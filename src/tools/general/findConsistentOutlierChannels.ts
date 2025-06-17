import { z } from "zod";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { regionCodeSchema } from "../../utils/validation.js";
import { Db } from "mongodb";
import { CacheService } from "../../services/cache.service.js";
import { NicheAnalyzerService } from "../../services/nicheAnalyzer.service.js";
import { YoutubeService } from "../../services/youtube.service.js";
import { NicheRepository } from "../../services/analysis/niche.repository.js";
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
        "Optional. Filters by channel age. Default: 'NEW'. 'NEW' = under 6 months (emerging), 'ESTABLISHED' = 6-24 months (proven)."
      ),

    consistencyLevel: z
      .enum(["MODERATE", "HIGH"])
      .optional()
      .describe(
        "Optional. Minimum required consistency. Default: 'MODERATE'. 'MODERATE' (~30%) for broad discovery. 'HIGH' (~50%) for exceptional channels."
      ),

    outlierMagnitude: z
      .enum(["STANDARD", "STRONG"])
      .optional()
      .describe(
        "Optional. Required 'viral factor' for videos. Default: 'STANDARD'. 'STANDARD' (views>subs) for regular content. 'STRONG' (views>3x subs) for viral channels."
      ),

    videoCategoryId: z
      .string()
      .optional()
      .describe(
        "Optional. YouTube video category ID to narrow search (e.g., '27' for Education). Improves relevance."
      ),

    regionCode: z
      .string()
      .length(2)
      .optional()
      .describe(
        "Optional. ISO 2-letter country code (e.g., 'US', 'DE') to target a regional audience."
      ),

    maxResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Optional. Max number of channels to return. Default: 10."),
  },
};

export const findConsistentOutlierChannelsHandler = async (
  params: FindConsistentOutlierChannelsOptions,
  youtubeService: YoutubeService,
  cacheService: CacheService,
  db: Db
): Promise<CallToolResult> => {
  try {
    const nicheRepository = new NicheRepository(db);
    const nicheAnalyzer = new NicheAnalyzerService(
      cacheService,
      youtubeService,
      nicheRepository
    );

    const validatedParams = findConsistentOutlierChannelsSchema.parse(params);

    const searchResults =
      await nicheAnalyzer.findConsistentOutlierChannels(validatedParams);

    return formatSuccess(searchResults);
  } catch (error: any) {
    return formatError(error);
  }
};
