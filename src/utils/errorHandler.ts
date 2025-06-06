export interface ErrorResponse {
  error: string;
  details?: any;
}

export const formatError = (
  error: unknown
): { content: Array<{ type: "text"; text: string }> } => {
  const errorResponse: ErrorResponse = {
    error: getErrorMessage(error),
  };

  // Include additional details if available (e.g., from YouTube API)
  if (hasResponseData(error)) {
    errorResponse.details = error.response.data;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(errorResponse, null, 2),
      },
    ],
  };
};

// Helper function to safely extract error message
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
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
): error is { response: { data: any } } => {
  return (
    error !== null &&
    typeof error === "object" &&
    "response" in error &&
    error.response !== null &&
    typeof error.response === "object" &&
    "data" in error.response
  );
};

export const handleAsyncError = async <T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error: unknown) {
    throw new Error(`${errorMessage}: ${getErrorMessage(error)}`);
  }
};
