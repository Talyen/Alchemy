import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".vite", "Raw Assets"] },

  // Base recommended configs
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // React hooks + refresh
  {
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
  },

  prettierConfig,

  // Allow unused args prefixed with _
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // Node.js scripts (CommonJS + ESM) — after base rules so overrides take effect
  {
    files: ["desktop/**/*.cjs", "postcss.config.mjs", "scripts/**/*.mjs"],
    languageOptions: { globals: { console: "readable", process: "readable", require: "readable", module: "readable", __dirname: "readable", __filename: "readable", Buffer: "readable", setTimeout: "readable", clearTimeout: "readable", setInterval: "readable", clearInterval: "readable" } },
    rules: { "@typescript-eslint/no-require-imports": "off", "no-undef": "off" },
  },

  // tailwind.config.ts uses `require()` for the plugin despite being a TS/ESM project
  {
    files: ["tailwind.config.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // Screenshot scripts (browser env)
  {
    files: ["screenshot-script.*"],
    languageOptions: { globals: { document: "readable", console: "readable", require: "readable" } },
    rules: { "@typescript-eslint/no-require-imports": "off", "no-undef": "off" },
  },
);
