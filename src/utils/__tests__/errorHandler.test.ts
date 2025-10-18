import { formatError } from "../errorHandler";
import { AppError, YouTubeApiError } from "../../errors/api.errors.js";

describe("errorHandler", () => {
  describe("formatError", () => {
    it("should format a standard Error object", () => {
      const error = new Error("Standard error message");
      expect(formatError(error)).toEqual({
        success: false,
        error: {
          error: "ToolExecutionError",
          message: "Standard error message",
        },
        content: [],
      });
    });

    it("should format a string with a default error message", () => {
      const error = "This is just a string";
      expect(formatError(error)).toEqual({
        success: false,
        error: {
          error: "ToolExecutionError",
          message: "An unknown error occurred",
        },
        content: [],
      });
    });

    it("should format an object with a message property with a default error message", () => {
      const error = { message: "I am an object, not an Error" };
      expect(formatError(error)).toEqual({
        success: false,
        error: {
          error: "ToolExecutionError",
          message: "An unknown error occurred",
        },
        content: [],
      });
    });

    it("should format null with a default error message", () => {
      expect(formatError(null)).toEqual({
        success: false,
        error: {
          error: "ToolExecutionError",
          message: "An unknown error occurred",
        },
        content: [],
      });
    });

    it("should format undefined with a default error message", () => {
      expect(formatError(undefined)).toEqual({
        success: false,
        error: {
          error: "ToolExecutionError",
          message: "An unknown error occurred",
        },
        content: [],
      });
    });

    it("should format a custom AppError correctly", () => {
      const customDetails = { originalCode: 500, reason: "API Limit Exceeded" };
      const appError = new AppError("Custom application error", customDetails);
      expect(formatError(appError)).toEqual({
        success: false,
        error: {
          error: "AppError",
          message: "Custom application error",
          details: customDetails,
        },
        content: [],
      });
    });

    it("should format a custom YouTubeApiError correctly", () => {
      const originalGoogleError = {
        response: {
          data: {
            error: {
              code: 403,
              message: "Forbidden",
              errors: [{ domain: "youtube.quota", reason: "quotaExceeded" }],
            },
          },
        },
      };
      const youtubeApiError = new YouTubeApiError(
        "YouTube API call failed",
        originalGoogleError
      );
      expect(formatError(youtubeApiError)).toEqual({
        success: false,
        error: {
          error: "YouTubeApiError",
          message: "YouTube API call failed",
          details: originalGoogleError.response.data,
        },
        content: [],
      });
    });
  });
});
