import "dotenv/config";

// Mapping of flag names to their corresponding environment variables
export const FEATURE_FLAGS = {
  toolGetCommentSentiment: "FEATURE_FLAG_TOOL_COMMENT_SENTIMENT",
  toolAnalyzeThumbnails: "FEATURE_FLAG_TOOL_ANALYZE_THUMBNAILS",
} as const;

type FlagName = keyof typeof FEATURE_FLAGS;

/**
 * Checks whether a feature flag is enabled.
 * @param name The name of the feature flag as defined in FEATURE_FLAGS.
 * @param env Optional object for environment overrides (default is process.env).
 * @returns true if the flag is set to "true" (case-insensitive), false otherwise.
 */
export function isEnabled(
  name: FlagName,
  env: Record<string, string | undefined> = process.env
): boolean {
  const envVarName = FEATURE_FLAGS[name];
  const value = env[envVarName]?.toLowerCase();

  return value === "true";
}
