/**
 * Calculates the like-to-view ratio for a video
 * @param viewCount - Number of views as string or number
 * @param likeCount - Number of likes as string or number
 * @returns Like-to-view ratio rounded to 5 decimal places, or 0 if calculation fails
 */
export function calculateLikeToViewRatio(
  viewCount: string | number | null | undefined,
  likeCount: string | number | null | undefined
): number {
  try {
    const views = parseInt(String(viewCount || "0"));
    const likes = parseInt(String(likeCount || "0"));

    if (isNaN(views) || isNaN(likes) || views <= 0) {
      return 0;
    }

    // Calculate the raw ratio
    const rawRatio = Math.max(0, likes) / views;

    // Round to 5 decimal places and convert back to a number
    return Number(rawRatio.toFixed(5));
  } catch (error) {
    console.error("Error in calculateLikeToViewRatio:", {
      viewCount,
      likeCount,
      error,
    });
    return 0;
  }
}

/**
 * Calculates the comment-to-view ratio for a video
 * @param viewCount - Number of views as string or number
 * @param commentCount - Number of comments as string or number
 * @returns Comment-to-view ratio rounded to 5 decimal places, or 0 if calculation fails
 */
export function calculateCommentToViewRatio(
  viewCount: string | number | null | undefined,
  commentCount: string | number | null | undefined
): number {
  try {
    const views = parseInt(String(viewCount || "0"));
    const comments = parseInt(String(commentCount || "0"));

    if (isNaN(views) || isNaN(comments) || views <= 0) {
      return 0;
    }

    // Calculate the raw ratio
    const rawRatio = Math.max(0, comments) / views;

    // Round to 5 decimal places and convert back to a number
    return Number(rawRatio.toFixed(5));
  } catch (error) {
    console.error("Error in calculateCommentToViewRatio:", {
      viewCount,
      commentCount,
      error,
    });
    return 0;
  }
}
