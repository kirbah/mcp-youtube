import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads environment variables from a .env file if it exists.
 * Uses the native Node.js process.loadEnvFile() available in Node.js 20.12.0+.
 */
export function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch (error) {
      console.error("Failed to load .env file:", error);
    }
  }
}
