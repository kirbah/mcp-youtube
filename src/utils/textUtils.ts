export const truncateDescription = (
  description: string | null | undefined,
  maxLength: number = 1000
): string | null => {
  if (!description) return null;
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + "...";
};
