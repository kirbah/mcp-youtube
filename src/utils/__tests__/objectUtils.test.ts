import { omitPaths } from "../objectUtils";

describe("omitPaths", () => {
  // A sample object to use for testing
  const testObject = {
    id: "123",
    status: {
      isPublic: true,
      canEmbed: false,
    },
    snippet: {
      title: "Test Video",
      description: "A description",
      thumbnails: {
        default: { url: "default.jpg" },
        high: { url: "high.jpg" },
      },
    },
    analytics: null,
    tags: ["a", "b"],
  };

  it("should remove a single top-level property", () => {
    const result = omitPaths(testObject, ["id"]);
    expect(result).not.toHaveProperty("id");
    expect(result).toHaveProperty("status");
  });

  it("should remove a single deeply nested property", () => {
    const result = omitPaths(testObject, ["snippet.thumbnails"]);
    expect(result.snippet).not.toHaveProperty("thumbnails");
    expect(result.snippet).toHaveProperty("title");
  });

  it("should remove multiple properties, including nested ones", () => {
    const result = omitPaths(testObject, [
      "status.isPublic",
      "snippet.thumbnails",
    ]);
    expect(result.status).not.toHaveProperty("isPublic");
    expect(result.status).toHaveProperty("canEmbed");
    expect(result.snippet).not.toHaveProperty("thumbnails");
  });

  it("should handle a path that does not exist gracefully", () => {
    const result = omitPaths(testObject, ["nonexistent.path"]);
    // The object should be identical to the original
    expect(result).toEqual(testObject);
  });

  it("should handle a partially correct path gracefully", () => {
    const result = omitPaths(testObject, ["snippet.nonexistent.key"]);
    expect(result).toEqual(testObject);
  });

  it("should handle a path to a non-object gracefully", () => {
    const result = omitPaths(testObject, ["snippet.title.subproperty"]);
    expect(result).toEqual(testObject);
  });

  it("should not mutate the original object", () => {
    // Create a clone of the original object to compare against later
    const originalObjectClone = JSON.parse(JSON.stringify(testObject));

    // Perform the operation
    omitPaths(testObject, ["snippet.thumbnails"]);

    // Check that the original testObject is unchanged
    expect(testObject).toEqual(originalObjectClone);
    expect(testObject.snippet).toHaveProperty("thumbnails");
  });

  it("should return an identical object if paths array is empty", () => {
    const result = omitPaths(testObject, []);
    expect(result).toEqual(testObject);
  });

  it("should handle an empty object as input", () => {
    const result = omitPaths({}, ["a.b"]);
    expect(result).toEqual({});
  });
});
