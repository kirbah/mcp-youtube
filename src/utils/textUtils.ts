export type DescriptionDetail = "NONE" | "SNIPPET" | "LONG";

export const truncateDescription = (
  description: string | null | undefined,
  maxLength: number = 1000
): string | null => {
  if (description === null || description === undefined) return null;
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + "...";
};

export const formatDescription = (
  description: string | null | undefined,
  descriptionDetail: DescriptionDetail
): string | undefined => {
  if (descriptionDetail === "NONE") return undefined;
  if (description === null || description === undefined) return undefined;

  const maxLength = descriptionDetail === "SNIPPET" ? 150 : 500; // LONG = 500

  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + "...";
};
