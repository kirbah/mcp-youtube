import { calculateLikeToViewRatio, calculateCommentToViewRatio } from '../engagementCalculator';

describe('engagementCalculator', () => {
  describe('calculateLikeToViewRatio', () => {
    it('should return the correct like-to-view ratio for valid inputs', () => {
      expect(calculateLikeToViewRatio(1000, 100)).toBe(0.1);
    });

    it('should return 0 if views are zero', () => {
      expect(calculateLikeToViewRatio(0, 100)).toBe(0);
    });

    it('should return 0 if likes are zero', () => {
      expect(calculateLikeToViewRatio(1000, 0)).toBe(0);
    });

    it('should return 0 if views are null', () => {
      expect(calculateLikeToViewRatio(null, 100)).toBe(0);
    });

    it('should return 0 if likes are null', () => {
      expect(calculateLikeToViewRatio(1000, null)).toBe(0);
    });

    it('should return 0 if views are undefined', () => {
      expect(calculateLikeToViewRatio(undefined, 100)).toBe(0);
    });

    it('should return 0 if likes are undefined', () => {
      expect(calculateLikeToViewRatio(1000, undefined)).toBe(0);
    });

    it('should return the correct ratio for string inputs that can be parsed', () => {
      expect(calculateLikeToViewRatio("1000", "100")).toBe(0.1);
    });

    it('should return 0 if views are a non-parsable string', () => {
      expect(calculateLikeToViewRatio("abc", 100)).toBe(0);
    });

    it('should return 0 if likes are a non-parsable string', () => {
      expect(calculateLikeToViewRatio(1000, "xyz")).toBe(0);
    });
  });

  describe('calculateCommentToViewRatio', () => {
    it('should return the correct comment-to-view ratio for valid inputs', () => {
      expect(calculateCommentToViewRatio(1000, 10)).toBe(0.01);
    });

    it('should return 0 if views are zero', () => {
      expect(calculateCommentToViewRatio(0, 10)).toBe(0);
    });

    it('should return 0 if comments are zero', () => {
      expect(calculateCommentToViewRatio(1000, 0)).toBe(0);
    });

    it('should return 0 if views are null', () => {
      expect(calculateCommentToViewRatio(null, 10)).toBe(0);
    });

    it('should return 0 if comments are null', () => {
      expect(calculateCommentToViewRatio(1000, null)).toBe(0);
    });

    it('should return 0 if views are undefined', () => {
      expect(calculateCommentToViewRatio(undefined, 10)).toBe(0);
    });

    it('should return 0 if comments are undefined', () => {
      expect(calculateCommentToViewRatio(1000, undefined)).toBe(0);
    });

    it('should return the correct ratio for string inputs that can be parsed', () => {
      expect(calculateCommentToViewRatio("1000", "10")).toBe(0.01);
    });

    it('should return 0 if views are a non-parsable string', () => {
      expect(calculateCommentToViewRatio("abc", 10)).toBe(0);
    });

    it('should return 0 if comments are a non-parsable string', () => {
      expect(calculateCommentToViewRatio(1000, "xyz")).toBe(0);
    });
  });
});
