import { z } from "zod";
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { BasePrompt } from "./base.js";

const AnalyzeNicheSchema = z.object({
  query: z
    .string()
    .describe("The niche topic (e.g. 'stoicism', 'coding tutorials')"),
});

export class AnalyzeNichePrompt extends BasePrompt<typeof AnalyzeNicheSchema> {
  name = "analyze-niche";
  description = "Deep dive analysis of a specific YouTube niche";
  schema = AnalyzeNicheSchema;

  protected getImpl(
    params: z.infer<typeof AnalyzeNicheSchema>
  ): Promise<GetPromptResult> {
    return Promise.resolve({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please run a deep analysis on the '${params.query}' niche. 
Use the 'findConsistentOutlierChannels' tool to identify channels that are overperforming relative to their subscriber count. 
Focus on 'NEW' channels with 'MODERATE' consistency.`,
          },
        },
      ],
    });
  }
}
