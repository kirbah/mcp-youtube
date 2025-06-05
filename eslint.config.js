// eslint.config.js
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "dist/",
      "node_modules/",
      "coverage/",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.cjs",
    ],
  },

  // Base JavaScript recommended rules
  js.configs.recommended,

  // TypeScript recommended rules (type-aware).
  // This is what brings in the stricter type checking.
  ...tseslint.configs.recommendedTypeChecked,

  // Configuration for your TypeScript files
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        project: true, // Crucial for recommendedTypeChecked
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // === Your original/current desired rules ===
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_", // Handles unused 'e' in catch(e)
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn", // Keep as warn

      // === Downgrade unsafe operations to warnings (from errors by recommendedTypeChecked) ===
      // This will make your lint pass while still showing where improvements are needed.
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",

      // === Rules that are often errors with type-checking, keep as error if possible ===
      // If these also cause too many errors initially, you can temporarily set them to "warn".
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: { attributes: false },
        },
      ],
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          ignoreVoid: true,
        },
      ],
    },
  }
);
