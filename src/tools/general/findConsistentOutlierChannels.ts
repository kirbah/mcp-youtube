import { z } from "zod";
import { formatError } from "../../utils/errorHandler.js";
import { formatSuccess } from "../../utils/responseFormatter.js";
import { regionCodeSchema } from "../../utils/validation.js";
import { NicheAnalyzerService } from "../../services/nicheAnalyzer.service.js";
import { YoutubeService } from "../../services/youtube.service.js";
import { NicheRepository } from "../../services/analysis/niche.repository.js";
import type { FindConsistentOutlierChannelsOptions } from "../../types/analyzer.types.js";
import type { FindConsistentOutlierChannelsParams } from "../../types/tools.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const findConsistentOutlierChannelsSchema = z.object({
  query: z
    .string()
    .min(1, "Query is required")
    .describe(
      "Required. The core topic or niche to investigate (e.g., 'stoic philosophy', 'AI history explainers')."
    ),
  channelAge: z
    .enum(["NEW", "ESTABLISHED"])
    .default("NEW")
    .describe(
      "Optional. Filters by channel age. Default: 'NEW'. 'NEW' = under 6 months (emerging), 'ESTABLISHED' = 6-24 months (proven)."
    ),
  consistencyLevel: z
    .enum(["MODERATE", "HIGH"])
    .default("MODERATE")
    .describe(
      "Optional. Minimum required consistency. Default: 'MODERATE'. 'MODERATE' (~30%) for broad discovery. 'HIGH' (~50%) for exceptional channels."
    ),
  outlierMagnitude: z
    .enum(["STANDARD", "STRONG"])
    .default("STANDARD")
    .describe(
      "Optional. Required 'viral factor' for videos. Default: 'STANDARD'. 'STANDARD' (views>subs) for regular content. 'STRONG' (views>3x subs) for viral channels."
    ),
  videoCategoryId: z
    .string()
    .optional()
    .describe(
      "Optional. YouTube video category ID to narrow search (e.g., '27' for Education). Improves relevance."
    ),
  regionCode: regionCodeSchema
    .optional()
    .describe(
      "Optional. ISO 2-letter country code (e.g., 'US', 'DE') to target a regional audience."
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Optional. Max number of channels to return. Default: 10."),
});

export const findConsistentOutlierChannelsConfig = {
  name: "findConsistentOutlierChannels",
  description:
    "A powerful, high-cost discovery tool. It finds emerging channels that show consistent, high-performance relative to their size within a specific topic and timeframe.",
  inputSchema: findConsistentOutlierChannelsSchema,
};

export const findConsistentOutlierChannelsHandler = async (
  params: FindConsistentOutlierChannelsParams,
  youtubeService: YoutubeService
): Promise<CallToolResult> => {
  try {
    // --- THIS IS THE EXPLICIT CONVERSION POINT ---
    // We use Zod to parse the user's flexible input.
    // The result of `parse` is a new, complete object with all defaults applied.
    // This new object perfectly matches the strict `...Options` type.
    const validatedOptions: FindConsistentOutlierChannelsOptions =
      findConsistentOutlierChannelsSchema.parse(params);

    // Now, we create our services and pass them the strict, validated options.
    const nicheRepository = new NicheRepository();
    const nicheAnalyzer = new NicheAnalyzerService(
      youtubeService,
      nicheRepository
    );

    // The analyzer's method is called with the guaranteed, complete options object.
    const searchResults =
      await nicheAnalyzer.findConsistentOutlierChannels(validatedOptions);

    return formatSuccess(searchResults);
  } catch (error: any) {
    return formatError(error);
  }
};
