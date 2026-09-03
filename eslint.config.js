import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";
import playwright from "eslint-plugin-playwright";
import jsxA11y from "eslint-plugin-jsx-a11y";
import vitest from "@vitest/eslint-plugin";
import { BOUNDARY_CONFIGS } from "./eslint/boundaries.js";
import { alchemyPlugin } from "./eslint/plugin.js";
import {
  AGGREGATE_NO_DIRECT_MUTATION,
  ASSET_BARREL_NO_VALUE_IMPORT_SELECTORS,
  BATTLE_NO_DIRECT_RNG,
  BATTLE_NO_MATH_FLOOR,
  BATTLE_NO_MATH_RANDOM,
  CLASSNAME_NO_TEMPLATE,
  GEAR_NO_OUTER_DISPATCH,
  NO_UNOWNED_CONTEXT_CREATION,
  restrictedImports,
  restrictedSyntax,
} from "./eslint/fragments.js";

function tsxSyntax(...extras) {
  return restrictedSyntax(...CLASSNAME_NO_TEMPLATE, ...extras);
}

function syntaxBlock(files, ignores, ...fragments) {
  return {
    files,
    ...(ignores ? { ignores } : {}),
    rules: {
      "no-restricted-syntax": restrictedSyntax(...fragments),
    },
  };
}

function tsxBlock(files, ignores, ...fragments) {
  return {
    files,
    ...(ignores ? { ignores } : {}),
    rules: {
      "no-restricted-syntax": tsxSyntax(...fragments),
    },
  };
}

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
      ".eslintcache",
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
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

  // Tune strictTypeChecked — only actual deviations from the preset live here.
  // Everything else (no-floating-promises, no-unsafe-*, unbound-method, …) is
  // already "error" in strictTypeChecked; do not restate preset defaults.
  {
    files: ["src/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
          allowBoolean: true,
          allowNever: true,
          allowAny: false,
          allowNullish: true,
        },
      ],
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-invalid-void-type": "off",
      // Additions beyond the preset — type-aware bug catchers.
      "@typescript-eslint/consistent-type-exports": ["error", { fixMixedExportsWithInlineTypeSpecifier: true }],
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
          minimumDescriptionLength: 3,
        },
      ],
    },
  },

  // Tests and non-src files — disable type-aware rules (they parse fine without project info)
  {
    files: ["tests/**", "scripts/**", "desktop/**", "performance/**", "*.config.*"],
    ...tseslint.configs.disableTypeChecked,
  },

  // React hooks + refresh — scoped to application source and React unit tests
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.test.tsx", "tests/**/*.dom.test.ts"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat["recommended-latest"].rules,
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
  },

  prettierConfig,

  // Global style rules (no types needed)
  {
    rules: {
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-promise-executor-return": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports", disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
    },
  },

  // ── Convention enforcement rules ──────────────────────────────────────────

  {
    plugins: { alchemy: alchemyPlugin },
  },
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      "alchemy/no-comments": "error",
    },
  },
  {
    files: [
      "src/lib/game-data/assets.generated.ts",
      "src/lib/game-data/gear-art.ts",
      "src/lib/validation/metadata.generated.ts",
    ],
    rules: {
      "alchemy/no-comments": "off",
    },
  },
  {
    files: ["eslint/**/*.js", "scripts/**/*.{js,mjs}", "*.config.*"],
    rules: {
      "alchemy/no-comments": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "alchemy/no-run-earned-add-materials": "error",
      "alchemy/no-unowned-web-storage": "error",
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "alchemy/no-lib-fetch": "error",
    },
  },
  {
    files: [
      "src/lib/mystery/**/*.{ts,tsx}",
      "src/lib/game-data/**/*.{ts,tsx}",
      "src/lib/gear/**/*.{ts,tsx}",
      "src/lib/content-systems/**/*.{ts,tsx}",
      "src/features/alchemy/run-loop/screens/**/*.{ts,tsx}",
      "src/features/alchemy/run-setup/screens/**/*.{ts,tsx}",
      "src/features/alchemy/meta/screens/**/*.{ts,tsx}",
    ],
    rules: {
      "alchemy/no-em-dash": "error",
    },
  },

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

  // Co-located UI/route modules must stay off after boundary configs re-enable
  // react-refresh for shared/components UI. Last block wins in flat config.
  {
    files: [
      "src/app/screen-routes/*-routes.tsx",
      "src/app/screen-routes/*-route.tsx",
      "src/app/app-screen-chrome-context.tsx",
      "src/features/alchemy/shared/context/card-description-context.tsx",
      "src/features/alchemy/shared/ui/use-fade.tsx",
      "src/features/alchemy/shared/ui/card-description-ui.tsx",
      "src/features/alchemy/shared/ui/material-icons.tsx",
      "src/features/alchemy/shared/ui/collection-ui.tsx",
      "src/features/alchemy/meta/screens/homestead/helpers.tsx",
      "src/features/alchemy/meta/screens/armory/paged-picker-grid.tsx",
      "src/features/alchemy/meta/screens/armory/armory-character-tabs.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },

  // Source files: warn on `any` type usage.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-template-curly-in-string": "error",
    },
  },

  // Allow unused vars and args prefixed with _
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },

  // Test files — relax rules for test-specific patterns
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx", "performance/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Vitest unit tests — use recommended vitest linting
  {
    files: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "tests/**/*.dom.test.ts", "performance/**/*.ts"],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/no-conditional-expect": "off",
      "vitest/expect-expect": "off",
      "vitest/valid-expect": "off",
      "vitest/no-interpolation-in-snapshots": "off",
    },
  },

  // Intentionally conditional diagnostic suite — exempt from disabled-test enforcement
  {
    files: ["tests/e2e/**/*.ts", "tests/helpers/diagnostics/**/*.{ts,tsx}"],
    rules: {
      "vitest/no-disabled-tests": "off",
    },
  },

  // Playwright specs/fixtures/pages — not React, disable hook rules there only
  {
    files: ["tests/**/*.spec.ts", "tests/pages/**/*.ts", "tests/fixtures/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },

  // jsx-a11y semantic subset for application UI
  {
    files: ["src/**/*.tsx", "src/**/*.jsx"],
    plugins: {
      "jsx-a11y": jsxA11y,
    },
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": ["error", { ignoreNonDOM: true }],
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-noninteractive-tabindex": "error",
      "jsx-a11y/tabindex-no-positive": "error",
    },
  },

  // Playwright specs & test fixtures/pages — flake prevention without type-aware linting.
  // missing-playwright-await catches unawaited expect()/locator actions,
  // the most common source of flaky e2e tests.
  {
    ...playwright.configs["flat/recommended"],
    files: [
      "tests/**/*.spec.ts",
      "tests/pages/**/*.ts",
      "tests/fixtures/**/*.ts",
      "performance/scenarios/**/*.perf.ts",
    ],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // This suite intentionally uses conditional flows (save-state probing),
      // structural no-assert smoke tests, and force-clicks on dev-gated UI.
      "playwright/no-conditional-in-test": "off",
      "playwright/no-conditional-expect": "off",
      "playwright/expect-expect": "off",
      "playwright/no-force-option": "off",
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
        ...ASSET_BARREL_NO_VALUE_IMPORT_SELECTORS,
      ),
    },
  },

  // Everything Playwright's esbuild collects (specs + e2e/fixtures/pages/helpers)
  // must stay off the asset-coupled game-data/gear barrels' value imports. Those
  // barrels re-export .webp assets that Playwright's esbuild cannot parse, so a
  // single value import anywhere in the graph breaks the entire suite at
  // collection time. Type-only imports and deep imports of pure modules are fine.
  {
    files: [
      "tests/e2e/**/*.ts",
      "tests/fixtures/**/*.ts",
      "tests/pages/**/*.ts",
      "tests/helpers/**/*.ts",
      "tests/electron-helpers.ts",
    ],
    rules: {
      "no-restricted-syntax": restrictedSyntax(...ASSET_BARREL_NO_VALUE_IMPORT_SELECTORS),
    },
  },

  // Animation specs must not disable animations via fastBattle or enableFastMode.
  {
    files: [
      "tests/draw-discard-animations.spec.ts",
      "tests/battle-end-turn-canary.spec.ts",
      "performance/scenarios/**/*.perf.ts",
    ],
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: [
          {
            name: "./fixtures/e2e",
            message:
              "Animation specs must use @playwright/test directly — fixtures/e2e enables fastBattle/enableFastMode.",
          },
          {
            name: "../tests/fixtures/e2e",
            message: "Performance scenarios must keep real animations — do not import fixtures/e2e (fastBattle).",
          },
          {
            name: "../../tests/fixtures/e2e",
            message: "Performance scenarios must keep real animations — do not import fixtures/e2e (fastBattle).",
          },
        ],
      }),
      "no-restricted-syntax": restrictedSyntax(
        {
          selector: 'CallExpression[callee.name="enableFastMode"]',
          message: "Do not call enableFastMode in animation-focused specs or performance scenarios.",
        },
        ...ASSET_BARREL_NO_VALUE_IMPORT_SELECTORS,
      ),
    },
  },

  // Final no-restricted-syntax routing. Flat config replaces rule values, so
  // overlapping path policies must be composed in the same path-specific block.
  // ts/tsx pairs are built with syntaxBlock/tsxBlock so new fragments stay in sync.
  syntaxBlock(
    ["src/**/*.ts"],
    [
      "src/features/alchemy/shared/stores/**",
      "src/features/alchemy/run-loop/**",
      "src/features/alchemy/shell/**",
      "src/lib/battle/**",
    ],
    ...AGGREGATE_NO_DIRECT_MUTATION,
    ...NO_UNOWNED_CONTEXT_CREATION,
  ),
  tsxBlock(
    ["src/**/*.tsx"],
    [
      "src/features/alchemy/shared/stores/**",
      "src/features/alchemy/run-loop/**",
      "src/features/alchemy/shell/**",
      "src/lib/battle/**",
      "src/app/app-screen-chrome-context.tsx",
      "src/features/alchemy/shared/context/card-description-context.tsx",
    ],
    ...AGGREGATE_NO_DIRECT_MUTATION,
    ...NO_UNOWNED_CONTEXT_CREATION,
  ),
  syntaxBlock(
    ["src/lib/battle/**/*.ts"],
    ["src/lib/battle/status-helpers.ts", "src/lib/battle/rng.ts", "src/lib/battle/battle-setup.ts"],
    ...BATTLE_NO_MATH_RANDOM,
    ...BATTLE_NO_MATH_FLOOR,
    ...BATTLE_NO_DIRECT_RNG,
    ...AGGREGATE_NO_DIRECT_MUTATION,
    ...NO_UNOWNED_CONTEXT_CREATION,
  ),
  syntaxBlock(
    ["src/lib/battle/status-helpers.ts", "src/lib/battle/rng.ts", "src/lib/battle/battle-setup.ts"],
    undefined,
    ...BATTLE_NO_MATH_RANDOM,
    ...BATTLE_NO_MATH_FLOOR,
    ...AGGREGATE_NO_DIRECT_MUTATION,
    ...NO_UNOWNED_CONTEXT_CREATION,
  ),
  tsxBlock(
    ["src/lib/battle/**/*.tsx"],
    undefined,
    ...BATTLE_NO_MATH_RANDOM,
    ...BATTLE_NO_MATH_FLOOR,
    ...BATTLE_NO_DIRECT_RNG,
    ...AGGREGATE_NO_DIRECT_MUTATION,
    ...NO_UNOWNED_CONTEXT_CREATION,
  ),
  syntaxBlock(
    ["src/features/alchemy/run-loop/**/*.ts", "src/features/alchemy/shell/**/*.ts"],
    undefined,
    ...GEAR_NO_OUTER_DISPATCH,
    ...AGGREGATE_NO_DIRECT_MUTATION,
    ...NO_UNOWNED_CONTEXT_CREATION,
  ),
  tsxBlock(
    ["src/features/alchemy/run-loop/**/*.tsx", "src/features/alchemy/shell/**/*.tsx"],
    undefined,
    ...GEAR_NO_OUTER_DISPATCH,
    ...AGGREGATE_NO_DIRECT_MUTATION,
    ...NO_UNOWNED_CONTEXT_CREATION,
  ),

  // Node.js scripts (CommonJS + ESM) — after base rules so overrides take effect.
  {
    files: ["scripts/**/*.mjs", "eslint/**/*.js"],
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
        fetch: "readable",
        AbortSignal: "readable",
        URL: "readable",
      },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // Electron's .cjs entry uses runtime-injected CJS globals, so no-undef stays off.
  {
    files: ["desktop/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off", "no-undef": "off" },
  },
);
