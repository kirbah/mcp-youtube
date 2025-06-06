/**
 * Calculates the like-to-view ratio for a video
 * @param viewCount - Number of views as string or number
 * @param likeCount - Number of likes as string or number
 * @returns Like-to-view ratio as a decimal number (e.g., 0.0245) or null if calculation fails
 */
export function calculateLikeToViewRatio(
  viewCount: string | number | null | undefined,
  likeCount: string | number | null | undefined
): number | null {
  try {
    const views = parseInt(String(viewCount || "0"));
    const likes = parseInt(String(likeCount || "0"));

    if (views <= 0) {
      return 0;
    }

    return likes / views;
  } catch (error) {
    return null;
  }
}

/**
 * Calculates the comment-to-view ratio for a video
 * @param viewCount - Number of views as string or number
 * @param commentCount - Number of comments as string or number
 * @returns Comment-to-view ratio as a decimal number (e.g., 0.0015) or null if calculation fails
 */
export function calculateCommentToViewRatio(
  viewCount: string | number | null | undefined,
  commentCount: string | number | null | undefined
): number | null {
  try {
    const views = parseInt(String(viewCount || "0"));
    const comments = parseInt(String(commentCount || "0"));

    if (views <= 0) {
      return 0;
    }

    return comments / views;
  } catch (error) {
    return null;
  }
}
