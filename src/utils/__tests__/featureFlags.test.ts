import { isEnabled, FEATURE_FLAGS } from "../featureFlags";

describe("featureFlags", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env to its original state before each test
    // and ensure specific feature flags are reset if they were manipulated directly.
    process.env = { ...originalEnv };
    // Clear any potentially set flags from previous tests using a mock env
    // This is more about ensuring a clean slate for process.env manipulation tests
    for (const flagKey in FEATURE_FLAGS) {
      const envVarName = FEATURE_FLAGS[flagKey as keyof typeof FEATURE_FLAGS];
      delete process.env[envVarName];
    }
  });

  afterAll(() => {
    // Restore original process.env after all tests are done
    process.env = originalEnv;
  });

  it.each([
    ["true", true],
    ["TRUE", true],
    ["false", false],
    ["", false],
    [undefined, false],
  ])("should return %s when env variable is %s", (value, expected) => {
    process.env[FEATURE_FLAGS.toolGetCommentSentiment] = value;
    expect(isEnabled("toolGetCommentSentiment")).toBe(expected);
  });

  it('should return false if the feature flag environment variable is "false"', () => {
    process.env[FEATURE_FLAGS.toolGetCommentSentiment] = "false";
    expect(isEnabled("toolGetCommentSentiment")).toBe(false);
  });

  it("should return false if the feature flag environment variable is an arbitrary string", () => {
    process.env[FEATURE_FLAGS.toolGetCommentSentiment] = "enabled";
    expect(isEnabled("toolGetCommentSentiment")).toBe(false);
  });

  it("should use the provided env object for checking flags", () => {
    const mockEnv = {
      [FEATURE_FLAGS.toolAnalyzeThumbnails]: "true",
      [FEATURE_FLAGS.toolGetCommentSentiment]: "false",
    };
    expect(isEnabled("toolAnalyzeThumbnails", mockEnv)).toBe(true);
    expect(isEnabled("toolGetCommentSentiment", mockEnv)).toBe(false);
  });

  it("should handle all defined feature flags correctly when using process.env", () => {
    // Set all flags to true
    for (const flagKey in FEATURE_FLAGS) {
      const envVarName = FEATURE_FLAGS[flagKey as keyof typeof FEATURE_FLAGS];
      process.env[envVarName] = "true";
    }
    for (const flagKey in FEATURE_FLAGS) {
      expect(isEnabled(flagKey as keyof typeof FEATURE_FLAGS)).toBe(true);
    }

    // Set all flags to false
    for (const flagKey in FEATURE_FLAGS) {
      const envVarName = FEATURE_FLAGS[flagKey as keyof typeof FEATURE_FLAGS];
      process.env[envVarName] = "false";
    }
    for (const flagKey in FEATURE_FLAGS) {
      expect(isEnabled(flagKey as keyof typeof FEATURE_FLAGS)).toBe(false);
    }
  });
});
