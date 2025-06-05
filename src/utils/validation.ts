import { z } from "zod";

export const validateParams = <T>(params: T, schema: z.ZodSchema<T>): T => {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e) => e.message).join(", ")}`
      );
    }
    throw error;
  }
};

// Common validation schemas
export const videoIdSchema = z.string().min(1, "Video ID cannot be empty");
export const channelIdSchema = z.string().min(1, "Channel ID cannot be empty");
export const maxResultsSchema = z.number().min(1).max(500).optional();
export const querySchema = z.string().min(1, "Query cannot be empty");
export const languageSchema = z.string().optional();
export const regionCodeSchema = z
  .string()
  .length(2, "Region code must be 2 characters")
  .optional();
export const categoryIdSchema = z.string().optional();
