import js from "@eslint/js";

export default [
  { ignores: ["dist/**", "node_modules/**", "playwright-report/**", "test-results/**"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        window: "readonly",
        URL: "readonly",
        process: "readonly",
        Storage: "readonly",
        structuredClone: "readonly",
      },
    },
  },
];
