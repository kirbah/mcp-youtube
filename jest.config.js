export default {
  preset: "ts-jest",
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

  transformIgnorePatterns: ["node_modules/(?!youtube-transcript-plus/)"],

  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  collectCoverage: true,
  coverageReporters: ["json", "lcov", "text", "clover", "text-summary"],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts",
    "!src/tools/index.ts",
    "!src/types/**/*.ts",
    "!src/**/__tests__/**",
  ],

  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "test-results",
        outputName: "junit.xml",
        ancestorSeparator: " › ",
        classNameTemplate: "{classname}",
        titleTemplate: "{title}",
        suiteNameTemplate: "{filepath}",
      },
    ],
  ],
};
