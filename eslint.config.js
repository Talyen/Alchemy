import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";
import reactCompiler from "eslint-plugin-react-compiler";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".vite", "Raw Assets", "scratch"] },

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

  // React Compiler rules
  {
    plugins: {
      "react-compiler": reactCompiler,
    },
    rules: {
      "react-compiler/react-compiler": "error",
    },
  },

  prettierConfig,

  // ── Convention enforcement rules ──────────────────────────────────────────

  // Ban React.FC / React.FunctionComponent — use plain function components with explicit Props.
  {
    rules: {
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          types: {
            "React.FC": {
              message: "Use plain function components with explicit Props instead of React.FC.",
            },
            "React.FunctionComponent": {
              message: "Use plain function components with explicit Props instead of React.FunctionComponent.",
            },
          },
        },
      ],
    },
  },

  // Source files: enforce barrel imports instead of deep module paths.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/game-data/*"], message: "Import from @/lib/game-data (barrel) instead of deep paths." },
            { group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." },
            { group: ["@/lib/validation/*"], message: "Import from @/lib/validation (barrel) instead of deep paths." },
            { group: ["@/features/alchemy/screens/*"], message: "Import from @/features/alchemy/screens (barrel) instead of deep paths." },
            { group: ["@/features/alchemy/utils/*"], message: "Import from @/features/alchemy/utils (barrel) instead of deep paths." },
          ],
        },
      ],
    },
  },

  // Source files: warn on `any` type usage.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // JSX files: ban template-literal className (must use cn()).
  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXAttribute[name.name="className"][value.type="TemplateLiteral"]',
          message: "Use cn() from @/lib/utils for class names instead of template literals.",
        },
        {
          selector: 'JSXAttribute[name.name="className"][value.type="JSXExpressionContainer"] TemplateLiteral',
          message: "Use cn() from @/lib/utils for class names instead of template literals.",
        },
      ],
    },
  },

  // Battle engine rounding: use Math.round() instead of Math.floor() for all math.
  {
    files: ["src/lib/battle/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'CallExpression[callee.object.name="Math"][callee.property.name="floor"]',
          message: "Use Math.round() instead of Math.floor() in battle engine code.",
        },
      ],
    },
  },

  // Allow unused args prefixed with _
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // Test files — relax rules for test-specific patterns
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^(_|describe|it|expect|vi|beforeEach|afterEach)$" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Node.js scripts (CommonJS + ESM) — after base rules so overrides take effect
  {
    files: ["desktop/**/*.cjs", "scripts/**/*.mjs"],
    languageOptions: { globals: { console: "readable", process: "readable", require: "readable", module: "readable", __dirname: "readable", __filename: "readable", Buffer: "readable", setTimeout: "readable", clearTimeout: "readable", setInterval: "readable", clearInterval: "readable" } },
    rules: { "@typescript-eslint/no-require-imports": "off", "no-undef": "off" },
  },

  // Screenshot scripts (browser env)
  {
    files: ["screenshot-script.*"],
    languageOptions: { globals: { document: "readable", console: "readable", require: "readable" } },
    rules: { "@typescript-eslint/no-require-imports": "off", "no-undef": "off" },
  },
);
