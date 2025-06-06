/**
 * Safely parses YouTube API numeric strings to numbers
 * @param value - String value from YouTube API that represents a number
 * @returns Parsed number or 0 if parsing fails, null, undefined, or empty
 */
export function parseYouTubeNumber(value: string | undefined | null): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = parseInt(String(value), 10);
  return isNaN(parsed) ? 0 : parsed;
}
