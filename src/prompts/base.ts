import { z } from "zod";
import { IServiceContainer } from "../container.js";
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export abstract class BasePrompt<
  T extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
> {
  constructor(protected container: IServiceContainer) {}

  abstract name: string;
  abstract description: string;
  abstract schema: T;

  protected abstract getImpl(params: z.infer<T>): Promise<GetPromptResult>;

  public async get(params: unknown): Promise<GetPromptResult> {
    try {
      const validatedParams = await this.schema.parseAsync(params);
      return await this.getImpl(validatedParams);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Prompt generation failed: ${this.name}`, {
        error: errorMessage,
      });
      throw err;
    }
  }

  public getDefinition() {
    return {
      description: this.description,
      argsSchema: this.schema.shape,
    };
  }
}
