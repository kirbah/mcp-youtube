/**
 * Creates a new object by deeply cloning the original and then removing properties
 * specified by an array of dot-notation paths. It does not mutate the original object.
 *
 * @param obj The source object.
 * @param paths An array of strings representing the paths to exclude (e.g., 'snippet.thumbnails').
 * @returns A new object with the specified paths removed.
 */
export function omitPaths<T extends object>(obj: T, paths: string[]): T {
  // Use JSON.parse/stringify for a simple, effective deep clone for plain JSON objects.
  const newObj = JSON.parse(JSON.stringify(obj)) as T;

  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = newObj;

    // Navigate down the path to the parent of the target property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        // Path doesn't exist, so we can't delete anything.
        current = null;
        break;
      }
    }

    // If the parent exists, delete the final property
    if (current && typeof current === "object") {
      delete current[parts[parts.length - 1]];
    }
  }

  return newObj;
}
