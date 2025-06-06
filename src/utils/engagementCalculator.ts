/**
 * Calculates the like-to-view ratio for a video
 * @param viewCount - Number of views as string or number
 * @param likeCount - Number of likes as string or number
 * @returns Like-to-view ratio as a percentage string (e.g., "2.45%") or null if calculation fails
 */
export function calculateLikeToViewRatio(
  viewCount: string | number | null | undefined,
  likeCount: string | number | null | undefined
): string | null {
  try {
    const views = parseInt(String(viewCount || "0"));
    const likes = parseInt(String(likeCount || "0"));

    if (views <= 0) {
      return "0.00%";
    }

    const likeRatio = ((likes / views) * 100).toFixed(2);
    return `${likeRatio}%`;
  } catch (error) {
    return null;
  }
}

/**
 * Calculates the comment-to-view ratio for a video
 * @param viewCount - Number of views as string or number
 * @param commentCount - Number of comments as string or number
 * @returns Comment-to-view ratio as a percentage string (e.g., "0.15%") or null if calculation fails
 */
export function calculateCommentToViewRatio(
  viewCount: string | number | null | undefined,
  commentCount: string | number | null | undefined
): string | null {
  try {
    const views = parseInt(String(viewCount || "0"));
    const comments = parseInt(String(commentCount || "0"));

    if (views <= 0) {
      return "0.00%";
    }

    const commentRatio = ((comments / views) * 100).toFixed(2);
    return `${commentRatio}%`;
  } catch (error) {
    return null;
  }
}
