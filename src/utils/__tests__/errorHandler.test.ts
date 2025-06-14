import { formatError, ErrorResponse } from "../errorHandler"; // Assuming ErrorResponse is exported for type checking if needed

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

    it("should format a string error message", () => {
      const error = "String error message";
      expect(formatError(error)).toEqual({
        success: false,
        error: { error: "ToolExecutionError", message: "String error message" },
        content: [],
      });
    });

    it("should format an object with a message property", () => {
      const error = { message: "Object with message property" };
      expect(formatError(error)).toEqual({
        success: false,
        error: {
          error: "ToolExecutionError",
          message: "Object with message property",
        },
        content: [],
      });
    });

    it("should format an error object with response data", () => {
      const error = {
        message: "Request failed",
        response: {
          data: {
            code: 404,
            message: "Not Found",
          },
        },
      };
      expect(formatError(error)).toEqual({
        success: false,
        error: {
          error: "ToolExecutionError",
          message: "Request failed",
          details: {
            code: 404,
            message: "Not Found",
          },
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

    it("should format a number with a default error message", () => {
      expect(formatError(123)).toEqual({
        success: false,
        error: {
          error: "ToolExecutionError",
          message: "An unknown error occurred",
        },
        content: [],
      });
    });

    it("should format an object without a message property with a default error message", () => {
      const error = { foo: "bar" };
      expect(formatError(error)).toEqual({
        success: false,
        error: {
          error: "ToolExecutionError",
          message: "An unknown error occurred",
        },
        content: [],
      });
    });
  });
});
