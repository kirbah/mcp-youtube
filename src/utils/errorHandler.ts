export interface ErrorResponse {
  error: string;
  details?: any;
}

export const formatError = (
  error: any
): { content: Array<{ type: "text"; text: string }> } => {
  const errorResponse: ErrorResponse = {
    error: error.message || "An unknown error occurred",
  };

  // Include additional details if available (e.g., from YouTube API)
  if (error.response?.data) {
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

export const handleAsyncError = async <T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    throw new Error(`${errorMessage}: ${error.message}`);
  }
};
