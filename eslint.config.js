// eslint.config.js
import globals from "globals";
import tseslint from "typescript-eslint";
// import js from "@eslint/js"; // If you were using eslint:recommended

export default tseslint.config(
  // js.configs.recommended, // If you used eslint:recommended
  ...tseslint.configs.recommended, // Or .recommendedTypeChecked if you use type-aware linting
  {
    languageOptions: {
      globals: {
        ...globals.node, // Or globals.browser, globals.nodeBuiltin, etc.
      },
      parserOptions: {
        project: true, // If using type-aware linting, point to tsconfig.json
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Your specific rule overrides from .eslintrc.json go here
      // e.g., "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["dist/", "node_modules/"], // Add directories/files to ignore
  }
);
