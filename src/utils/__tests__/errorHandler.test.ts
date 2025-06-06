import { formatError } from '../errorHandler';

describe('errorHandler', () => {
  describe('formatError', () => {
    it('should format a standard Error object', () => {
      const error = new Error("Standard error message");
      expect(formatError(error)).toEqual({
        content: [{ type: "text", text: JSON.stringify({ error: "Standard error message" }, null, 2) }],
      });
    });

    it('should format a string error message', () => {
      const error = "String error message";
      expect(formatError(error)).toEqual({
        content: [{ type: "text", text: JSON.stringify({ error: "String error message" }, null, 2) }],
      });
    });

    it('should format an object with a message property', () => {
      const error = { message: "Object with message property" };
      expect(formatError(error)).toEqual({
        content: [{ type: "text", text: JSON.stringify({ error: "Object with message property" }, null, 2) }],
      });
    });

    it('should format an error object with response data', () => {
      const error = {
        response: { data: { code: 404, message: "Not Found" } },
        message: "Request failed",
      };
      expect(formatError(error)).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Request failed", details: { code: 404, message: "Not Found" } }, null, 2),
          },
        ],
      });
    });

    it('should format null with a default error message', () => {
      expect(formatError(null)).toEqual({
        content: [{ type: "text", text: JSON.stringify({ error: "An unknown error occurred" }, null, 2) }],
      });
    });

    it('should format undefined with a default error message', () => {
      expect(formatError(undefined)).toEqual({
        content: [{ type: "text", text: JSON.stringify({ error: "An unknown error occurred" }, null, 2) }],
      });
    });

    it('should format a number with a default error message', () => {
      expect(formatError(123)).toEqual({
        content: [{ type: "text", text: JSON.stringify({ error: "An unknown error occurred" }, null, 2) }],
      });
    });

    it('should format an object without a message property with a default error message', () => {
      const error = { foo: "bar" };
      expect(formatError(error)).toEqual({
        content: [{ type: "text", text: JSON.stringify({ error: "An unknown error occurred" }, null, 2) }],
      });
    });
  });
});
