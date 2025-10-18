import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AppError } from "../errors/api.errors.js";

export interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

export const formatError = (error: unknown): CallToolResult => {
  // Check if the error is an instance of our custom AppError
  if (error instanceof AppError) {
    // If it is, we know it has a clean, predictable structure.
    const errorResponse: ErrorResponse = {
      error: error.name,
      message: error.message,
      details: error.details,
    };

    return {
      success: false,
      error: errorResponse,
      content: [],
    };
  }

  // Fallback for any other unexpected errors that are not AppErrors
  const errorMessage =
    error instanceof Error ? error.message : "An unknown error occurred";

  const errorResponse: ErrorResponse = {
    error: "ToolExecutionError",
    message: errorMessage,
  };

  return {
    success: false,
    error: errorResponse,
    content: [],
  };
};
