export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "esnext",
        },
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // --- Coverage Configuration ---
  collectCoverage: true,
  coverageReporters: ["json", "lcov", "text", "clover", "text-summary"], // lcov for Codecov, text-summary for console output
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts", // Exclude TypeScript declaration files
    "!src/index.ts", // Exclude main entry if it's mostly boilerplate
    "!src/tools/index.ts", // Exclude barrel files if they only re-export
    "!src/types/**/*.ts", // Exclude type definitions
    "!src/**/__tests__/**", // Exclude test files themselves
    // Add any other files/patterns to exclude from coverage
  ],
  // Optional: Set coverage thresholds
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80, // Or use a negative number like -10 to allow 10 uncovered statements
  //   },
  // },
  // --- End New Coverage Configuration ---
};
