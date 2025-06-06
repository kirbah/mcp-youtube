/**
 * Calculates the engagement ratio for a video based on its statistics
 * @param viewCount - Number of views as string or number
 * @param likeCount - Number of likes as string or number
 * @param commentCount - Number of comments as string or number
 * @returns Engagement ratio as a percentage string (e.g., "2.45%") or null if calculation fails
 */
export function calculateEngagementRatio(
  viewCount: string | number | null | undefined,
  likeCount: string | number | null | undefined,
  commentCount: string | number | null | undefined
): string | null {
  try {
    const views = parseInt(String(viewCount || "0"));
    const likes = parseInt(String(likeCount || "0"));
    const comments = parseInt(String(commentCount || "0"));

    if (views <= 0) {
      return "0.00%";
    }

    const engagementRatio = (((likes + comments) / views) * 100).toFixed(2);
    return `${engagementRatio}%`;
  } catch (error) {
    return null;
  }
}
