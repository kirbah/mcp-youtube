import { z } from "zod";
import {
  validateParams,
  videoIdSchema,
  channelIdSchema,
  maxResultsSchema,
  querySchema,
  languageSchema,
  regionCodeSchema,
  categoryIdSchema,
} from "../validation";

describe("validation", () => {
  describe("validateParams", () => {
    const testSchema = z.object({ name: z.string(), age: z.number() });

    it("should return params if they are valid", () => {
      const params = { name: "Test", age: 30 };
      expect(validateParams(params, testSchema)).toEqual(params);
    });

    it("should throw a formatted Error for invalid params", () => {
      const params = { name: "Test", age: "30" } as any; // Cast to any to allow invalid type for testing
      expect(() => validateParams(params, testSchema)).toThrow(Error);
      expect(() => validateParams(params, testSchema)).toThrow(
        "Validation error: Expected number, received string"
      );
    });

    it("should strip extra fields by default", () => {
      const params = { name: "Test", age: 30, extra: "field" };
      expect(validateParams(params, testSchema)).toEqual({
        name: "Test",
        age: 30,
      });
    });

    it("should re-throw non-ZodErrors", () => {
      const mockSchema = {
        parse: () => {
          throw new Error("Generic error");
        },
      } as any;
      const params = { name: "Test" };
      expect(() => validateParams(params, mockSchema)).toThrow("Generic error");
    });
  });

  describe("individual schemas", () => {
    describe("videoIdSchema", () => {
      it("should validate a correct video ID", () => {
        expect(videoIdSchema.parse("abcdef12345")).toBe("abcdef12345");
      });

      it("should invalidate an empty video ID", () => {
        expect(() => videoIdSchema.parse("")).toThrow(z.ZodError);
        try {
          videoIdSchema.parse("");
        } catch (e: any) {
          expect(e.issues[0].message).toBe("Video ID cannot be empty");
        }
      });
    });
    describe("channelIdSchema", () => {
      it("should validate a correct channel ID", () => {
        expect(channelIdSchema.parse("UCabcdef12345")).toBe("UCabcdef12345");
      });

      it("should invalidate an empty channel ID", () => {
        expect(() => channelIdSchema.parse("")).toThrow(z.ZodError);
        try {
          channelIdSchema.parse("");
        } catch (e: any) {
          expect(e.issues[0].message).toBe("Channel ID cannot be empty");
        }
      });
    });
    describe("maxResultsSchema", () => {
      it("should validate a correct maxResults value", () => {
        expect(maxResultsSchema.parse(25)).toBe(25);
      });

      it("should allow undefined for maxResults (optional)", () => {
        expect(maxResultsSchema.parse(undefined)).toBeUndefined();
      });

      it("should invalidate a maxResults value that is too small", () => {
        expect(() => maxResultsSchema.parse(0)).toThrow(z.ZodError);
      });

      it("should invalidate a maxResults value that is too large", () => {
        expect(() => maxResultsSchema.parse(501)).toThrow(z.ZodError);
      });
    });
    describe("querySchema", () => {
      it("should validate a correct query string", () => {
        expect(querySchema.parse("test query")).toBe("test query");
      });

      it("should invalidate an empty query string", () => {
        expect(() => querySchema.parse("")).toThrow(z.ZodError);
      });
    });
    describe("languageSchema", () => {
      it("should validate a correct language code", () => {
        expect(languageSchema.parse("en")).toBe("en");
      });

      it("should allow undefined for language code (optional)", () => {
        expect(languageSchema.parse(undefined)).toBeUndefined();
      });
    });
    describe("regionCodeSchema", () => {
      it("should validate a correct region code", () => {
        expect(regionCodeSchema.parse("US")).toBe("US");
      });

      it("should allow undefined for region code (optional)", () => {
        expect(regionCodeSchema.parse(undefined)).toBeUndefined();
      });

      it("should invalidate a region code that is too short", () => {
        expect(() => regionCodeSchema.parse("U")).toThrow(z.ZodError);
      });

      it("should invalidate a region code that is too long", () => {
        expect(() => regionCodeSchema.parse("USA")).toThrow(z.ZodError);
      });
    });
    describe("categoryIdSchema", () => {
      it("should validate a correct category ID", () => {
        expect(categoryIdSchema.parse("10")).toBe("10");
      });

      it("should allow undefined for category ID (optional)", () => {
        expect(categoryIdSchema.parse(undefined)).toBeUndefined();
      });
    });
  });
});
