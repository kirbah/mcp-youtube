import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface ErrorResponse {
  error: string;
  details?: unknown;
  message: string; // Add message to align with common error structures
}

export const formatError = (error: unknown): CallToolResult => {
  const errorMessage = getErrorMessage(error);
  const errorResponse: ErrorResponse = {
    error: "ToolExecutionError", // Standard error type
    message: errorMessage,
  };

  // Include additional details if available (e.g., from YouTube API)
  if (hasResponseData(error)) {
    errorResponse.details = error.response.data;
  }

  return {
    success: false,
    error: errorResponse,
    content: [], // Add empty content array to satisfy TS compiler
  };
};

// Helper function to safely extract error message
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  // Ensure that we import CallToolResult from the SDK if it's not already imported.
  // For now, we assume it's available or this change is part of a larger refactor.
  // import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
  if (typeof error === "string") {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "An unknown error occurred";
};

// Helper function to check if error has response data
const hasResponseData = (
  error: unknown
): error is { response: { data: unknown } } => {
  return (
    error !== null &&
    typeof error === "object" &&
    "response" in error &&
    error.response !== null &&
    typeof error.response === "object" &&
    "data" in error.response
  );
};
