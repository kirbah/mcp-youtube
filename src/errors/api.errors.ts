// A base class for all your application's operational errors
export class AppError extends Error {
  public readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// A specific error for YouTube API failures
export class YouTubeApiError extends AppError {
  constructor(message: string, originalError: unknown) {
    // Extract key details from the original Google API error
    const details = hasResponseData(originalError)
      ? originalError.response.data
      : originalError;

    super(message, details);
    this.name = "YouTubeApiError";
  }
}

// Helper to check the structure of the Google API error
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
