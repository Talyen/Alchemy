import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";
import reactCompiler from "eslint-plugin-react-compiler";
import { BOUNDARY_CONFIGS } from "./eslint/boundaries.js";
import {
  BATTLE_NO_MATH_FLOOR,
  BATTLE_NO_MATH_RANDOM,
  CLASSNAME_NO_TEMPLATE,
  restrictedImports,
  restrictedSyntax,
} from "./eslint/fragments.js";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      ".vite",
      "Raw Assets",
      "scratch",
      "playwright-report",
      "test-results",
      "coverage",
      "release-desktop",
      "reports",
      ".knip-output.json",
    ],
  },

  // Base recommended configs
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Type-aware rules — src only (slower but catches real bugs)
  {
    files: ["src/**"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.*"],
        },
      },
    },
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["src/**"],
  })),

  // Tune strictTypeChecked overrides — disable noisy rules that conflict with intentional patterns
  {
    files: ["src/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-parameters": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-unnecessary-type-arguments": "off",
      "@typescript-eslint/no-invalid-void-type": "off",
      "@typescript-eslint/no-misused-spread": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-dynamic-delete": "error",
      "@typescript-eslint/restrict-plus-operands": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-duplicate-type-constituents": "off",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/unbound-method": "error",
      "@typescript-eslint/no-useless-default-assignment": "off",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unnecessary-type-conversion": "off",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // Tests and non-src files — disable type-aware rules (they parse fine without project info)
  {
    files: ["tests/**", "scripts/**", "desktop/**", "*.config.*"],
    ...tseslint.configs.disableTypeChecked,
  },

  // React hooks + refresh
  {
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
  },

  // Route files and context files intentionally colocate hooks with screen
  // components — fast-refresh hot-replacement works correctly within each
  // domain route module.
  {
    files: ["src/app/screen-routes/*-routes.tsx", "src/app/app-screen-chrome-context.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
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

  // Global style rules (no types needed)
  {
    rules: {
      eqeqeq: ["error", "always", { null: "ignore" }],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports", disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
    },
  },

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

  // Import boundary layers — see eslint/boundaries.js
  ...BOUNDARY_CONFIGS,

  // Source files: warn on `any` type usage.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-template-curly-in-string": "error",
    },
  },

  // JSX files: ban template-literal className (must use cn()).
  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": restrictedSyntax(...CLASSNAME_NO_TEMPLATE),
    },
  },

  // Battle .tsx files: keep Math.random/floor bans alongside className bans.
  {
    files: ["src/lib/battle/**/*.tsx"],
    rules: {
      "no-restricted-syntax": restrictedSyntax(
        ...CLASSNAME_NO_TEMPLATE,
        ...BATTLE_NO_MATH_RANDOM,
        BATTLE_NO_MATH_FLOOR,
      ),
    },
  },

  // Allow unused args prefixed with _
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  // Test files — relax rules for test-specific patterns
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^(_|describe|it|expect|vi|beforeEach|afterEach)$" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // E2E specs run against preview/production builds — dev-only UI must not be targeted.
  {
    files: ["tests/**/*.spec.ts"],
    rules: {
      "no-restricted-syntax": restrictedSyntax(
        {
          selector: 'MemberExpression[property.name="skipCombatBtn"]',
          message:
            "Skip Combat is dev-only. Use winViaCombat(), playCardNamed(), or damage cards; CI e2e runs preview builds.",
        },
        {
          selector: 'CallExpression[callee.property.name="skipCombatToVictory"]',
          message: "skipCombatToVictory() is dev-only. Use winViaCombat() or playCardNamed() in preview-safe specs.",
        },
        {
          selector: 'Literal[value="Skip Combat"]',
          message: "Skip Combat is dev-only UI. Do not target it in e2e specs.",
        },
        {
          selector: 'Literal[value="Unlock All"]',
          message: "Unlock All is dev-only UI. Do not target it in e2e specs.",
        },
      ),
    },
  },

  // Animation specs must not disable animations via fastBattle or enableFastMode.
  {
    files: ["tests/draw-discard-animations.spec.ts", "tests/battle-end-turn-canary.spec.ts"],
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: [
          {
            name: "./fixtures/e2e",
            message:
              "Animation specs must use @playwright/test directly — fixtures/e2e enables fastBattle/enableFastMode.",
          },
        ],
      }),
      "no-restricted-syntax": restrictedSyntax(
        {
          selector: 'CallExpression[callee.name="enableFastMode"]',
          message: "Do not call enableFastMode in animation-focused specs.",
        },
        {
          selector: 'ImportDeclaration[source.value="./fixtures/e2e"]',
          message: "Animation specs must use @playwright/test directly — fixtures/e2e enables fastBattle.",
        },
      ),
    },
  },

  // Node.js scripts (CommonJS + ESM) — after base rules so overrides take effect
  {
    files: ["desktop/**/*.cjs", "scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readable",
        process: "readable",
        require: "readable",
        module: "readable",
        __dirname: "readable",
        __filename: "readable",
        Buffer: "readable",
        setTimeout: "readable",
        clearTimeout: "readable",
        setInterval: "readable",
        clearInterval: "readable",
      },
    },
    rules: { "@typescript-eslint/no-require-imports": "off", "no-undef": "off" },
  },
);
