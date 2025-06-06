import { parseYouTubeNumber } from '../numberParser';

describe('parseYouTubeNumber', () => {
  test('should return 0 for null input', () => {
    expect(parseYouTubeNumber(null)).toBe(0);
  });

  test('should return 0 for undefined input', () => {
    expect(parseYouTubeNumber(undefined)).toBe(0);
  });

  test('should return 0 for an empty string input', () => {
    expect(parseYouTubeNumber('')).toBe(0);
  });

  test('should parse a valid positive integer string', () => {
    expect(parseYouTubeNumber('123')).toBe(123);
  });

  test('should parse a valid negative integer string', () => {
    expect(parseYouTubeNumber('-456')).toBe(-456);
  });

  test('should parse "0"', () => {
    expect(parseYouTubeNumber('0')).toBe(0);
  });

  test('should return 0 for a non-numeric string', () => {
    expect(parseYouTubeNumber('abc')).toBe(0);
  });

  test('should handle strings with leading/trailing spaces', () => {
    expect(parseYouTubeNumber(' 789 ')).toBe(789);
  });

  test('should handle strings that are partially numeric followed by non-numeric characters', () => {
    expect(parseYouTubeNumber('123xyz')).toBe(123); // parseInt behavior
  });

  test('should handle strings representing floating-point numbers by truncating to integer', () => {
    expect(parseYouTubeNumber('10.99')).toBe(10); // parseInt behavior
  });

  test('should handle already numeric input (though type is string | undefined | null)', () => {
    // This case tests if String(value) works as expected for numbers if they were passed.
    // However, the function signature expects string, undefined or null.
    // Consider if this test is essential or if type enforcement makes it redundant.
    // For now, assuming it's a string representation of a number.
    expect(parseYouTubeNumber('777')).toBe(777);
  });

  test('should return 0 for string "NaN" as parseInt("NaN") is NaN', () => {
    expect(parseYouTubeNumber('NaN')).toBe(0);
  });

  test('should return 0 for string "Infinity" as parseInt("Infinity") is NaN in some JS engines or a specific value', () => {
    // parseInt behavior for "Infinity" can vary or be NaN.
    // Given our function returns 0 for NaN, this should be 0.
    expect(parseYouTubeNumber('Infinity')).toBe(0);
  });

   test('should return 0 for string "-Infinity"', () => {
    expect(parseYouTubeNumber('-Infinity')).toBe(0);
  });

  test('should handle very large numbers as strings if they don_t exceed JS limits for parseInt', () => {
    expect(parseYouTubeNumber('9007199254740990')).toBe(9007199254740990);
    // Max safe integer is 9007199254740991. parseInt can handle it.
  });

  test('should parse a string with only spaces as 0, as parseInt(" ") is NaN', () => {
    expect(parseYouTubeNumber('   ')).toBe(0);
  });
});
