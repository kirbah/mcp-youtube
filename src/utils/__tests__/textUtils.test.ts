import { truncateDescription, formatDescription } from "../textUtils";

describe("truncateDescription", () => {
  it("should return null for a null description", () => {
    expect(truncateDescription(null)).toBeNull();
  });

  it("should return null for an undefined description", () => {
    expect(truncateDescription(undefined)).toBeNull();
  });

  it("should return the same description if shorter than maxLength", () => {
    const desc = "Short description.";
    expect(truncateDescription(desc)).toBe(desc);
  });

  it('should truncate description longer than default maxLength (1000) and add "..."', () => {
    const longDesc = "a".repeat(1005);
    const expectedDesc = "a".repeat(1000) + "...";
    expect(truncateDescription(longDesc)).toBe(expectedDesc);
  });

  it("should return the same description if equal to default maxLength (1000)", () => {
    const desc = "a".repeat(1000);
    expect(truncateDescription(desc)).toBe(desc);
  });

  it('should truncate description longer than custom maxLength and add "..."', () => {
    const longDesc = "a".repeat(55);
    const customMaxLength = 50;
    const expectedDesc = "a".repeat(customMaxLength) + "...";
    expect(truncateDescription(longDesc, customMaxLength)).toBe(expectedDesc);
  });

  it("should return the same description if shorter than custom maxLength", () => {
    const desc = "Short description.";
    const customMaxLength = 100;
    expect(truncateDescription(desc, customMaxLength)).toBe(desc);
  });

  it("should return the same description if equal to custom maxLength", () => {
    const desc = "a".repeat(50);
    const customMaxLength = 50;
    expect(truncateDescription(desc, customMaxLength)).toBe(desc);
  });

  it("should return an empty string if description is an empty string", () => {
    expect(truncateDescription("")).toBe("");
  });

  it("should handle an empty string with a custom maxLength", () => {
    expect(truncateDescription("", 50)).toBe("");
  });

  it('should truncate to an empty string and add "..." if maxLength is 0 and description is not empty', () => {
    // This case highlights behavior with maxLength = 0.
    // String.prototype.substring(0, 0) is '', so it becomes "..."
    expect(truncateDescription("abc", 0)).toBe("...");
  });
});

describe("formatDescription", () => {
  it('should return undefined if descriptionDetail is "NONE"', () => {
    expect(formatDescription("Some description", "NONE")).toBeUndefined();
  });

  it('should return undefined if description is null and detail is "SNIPPET"', () => {
    expect(formatDescription(null, "SNIPPET")).toBeUndefined();
  });

  it('should return undefined if description is undefined and detail is "LONG"', () => {
    expect(formatDescription(undefined, "LONG")).toBeUndefined();
  });

  it('should return undefined if description is null and detail is "NONE" (already covered but good for clarity)', () => {
    expect(formatDescription(null, "NONE")).toBeUndefined();
  });

  // Tests for "SNIPPET" (maxLength 150)
  describe('with descriptionDetail "SNIPPET"', () => {
    const detail = "SNIPPET";
    const snippetMaxLength = 150;

    it("should return the same description if shorter than 150 chars", () => {
      const desc = "Short description.";
      expect(formatDescription(desc, detail)).toBe(desc);
    });

    it('should truncate description longer than 150 chars and add "..."', () => {
      const longDesc = "a".repeat(155);
      const expectedDesc = "a".repeat(snippetMaxLength) + "...";
      expect(formatDescription(longDesc, detail)).toBe(expectedDesc);
    });

    it("should return the same description if equal to 150 chars", () => {
      const desc = "a".repeat(snippetMaxLength);
      expect(formatDescription(desc, detail)).toBe(desc);
    });

    it("should return an empty string if description is an empty string", () => {
      expect(formatDescription("", detail)).toBe("");
    });
  });

  // Tests for "LONG" (maxLength 500)
  describe('with descriptionDetail "LONG"', () => {
    const detail = "LONG";
    const longMaxLength = 500;

    it("should return the same description if shorter than 500 chars", () => {
      const desc =
        "A medium length description that is less than 500 characters.";
      expect(formatDescription(desc, detail)).toBe(desc);
    });

    it('should truncate description longer than 500 chars and add "..."', () => {
      const veryLongDesc = "b".repeat(510);
      const expectedDesc = "b".repeat(longMaxLength) + "...";
      expect(formatDescription(veryLongDesc, detail)).toBe(expectedDesc);
    });

    it("should return the same description if equal to 500 chars", () => {
      const desc = "b".repeat(longMaxLength);
      expect(formatDescription(desc, detail)).toBe(desc);
    });

    it("should return an empty string if description is an empty string", () => {
      expect(formatDescription("", detail)).toBe("");
    });
  });

  it("should handle description that is exactly the SNIPPET maxLength (150)", () => {
    const desc = "a".repeat(150);
    expect(formatDescription(desc, "SNIPPET")).toBe(desc);
  });

  it("should handle description that is exactly the LONG maxLength (500)", () => {
    const desc = "a".repeat(500);
    expect(formatDescription(desc, "LONG")).toBe(desc);
  });
});
