import {
  AGGREGATE_NO_DIRECT_MUTATION,
  ASSET_BARREL_NO_VALUE_IMPORT_SELECTORS,
  BATTLE_NO_DIRECT_RNG,
  BATTLE_NO_MATH_FLOOR,
  BATTLE_NO_MATH_RANDOM,
  CLASSNAME_NO_TEMPLATE,
  GAMEPLAY_NO_MATH_RANDOM,
  NO_UNOWNED_CONTEXT_CREATION,
  PREVIEW_NO_DEV_CONTROLS,
  restrictedImports,
  restrictedSyntax,
} from "./fragments.js";
const CONTEXT_PROVIDERS = [
  "src/app/app-screen-chrome-context.tsx",
  "src/features/alchemy/shared/context/card-description-context.tsx",
];

function sourceBlock(files, extras = [], excludeFiles = []) {
  return {
    files,
    excludeFiles,
    rules: {
      "alchemy/restricted-syntax": restrictedSyntax(
        ...CLASSNAME_NO_TEMPLATE,
        ...AGGREGATE_NO_DIRECT_MUTATION,
        ...NO_UNOWNED_CONTEXT_CREATION,
        ...extras,
      ),
    },
  };
}

export const SYNTAX_CONFIGS = [
  // E2E specs run against preview/production builds — dev-only UI must not be targeted.
  {
    files: ["tests/**/*.spec.ts"],
    rules: {
      "alchemy/restricted-syntax": restrictedSyntax(
        ...PREVIEW_NO_DEV_CONTROLS,
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
      "tests/electron/electron-helpers.ts",
    ],
    excludeFiles: ["tests/**/*.spec.ts"],
    rules: {
      "alchemy/restricted-syntax": restrictedSyntax(...ASSET_BARREL_NO_VALUE_IMPORT_SELECTORS),
    },
  },

  // Animation specs must not disable animations via fastBattle or enableFastMode.
  {
    files: [
      "tests/e2e/specs/*animations.spec.ts",
      "tests/e2e/specs/*-transitions.spec.ts",
      "tests/e2e/specs/tooltip-motion.spec.ts",
      "tests/e2e/specs/stun-enemy-turn-presentation.spec.ts",
      "tests/e2e/specs/battle-end-turn-canary.spec.ts",
      "performance/scenarios/**/*.perf.ts",
    ],
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: [
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
      "alchemy/restricted-syntax": restrictedSyntax(
        {
          selector: "Identifier[name=/^(enableFastMode|useFastBattle|fastBattle)$/]",
          message: "Keep real animations: do not request fastBattle or use a fast-mode helper in timing specs.",
        },
        ...PREVIEW_NO_DEV_CONTROLS,
        ...ASSET_BARREL_NO_VALUE_IMPORT_SELECTORS,
      ),
    },
  },

  // JSX selectors are inert in .ts files. Compose each effective source policy
  // once; flat-config rule values replace earlier values rather than merging.
  sourceBlock(["src/**/*.{ts,tsx}"], [], ["src/features/alchemy/shared/stores/**", ...CONTEXT_PROVIDERS]),
  sourceBlock(
    ["src/lib/battle/**/*.{ts,tsx}"],
    [...BATTLE_NO_MATH_RANDOM, ...BATTLE_NO_MATH_FLOOR, ...BATTLE_NO_DIRECT_RNG],
    ["src/lib/battle/battle-setup.ts"],
  ),
  sourceBlock(["src/lib/battle/battle-setup.ts"], [...BATTLE_NO_MATH_RANDOM, ...BATTLE_NO_MATH_FLOOR]),
  sourceBlock(
    [
      "src/features/alchemy/run-loop/navigation/**/*.{ts,tsx}",
      "src/features/alchemy/run-loop/run/**/*.{ts,tsx}",
      "src/lib/mystery/**/*.{ts,tsx}",
      "src/lib/gear/**/*.{ts,tsx}",
      "src/lib/corruption/**/*.{ts,tsx}",
      "src/lib/game-data/reward-selection.ts",
    ],
    GAMEPLAY_NO_MATH_RANDOM,
  ),
  {
    files: ["src/features/alchemy/shared/stores/**/*.{ts,tsx}"],
    rules: {
      "alchemy/restricted-syntax": restrictedSyntax(...CLASSNAME_NO_TEMPLATE, ...NO_UNOWNED_CONTEXT_CREATION),
    },
  },
  {
    files: CONTEXT_PROVIDERS,
    rules: {
      "alchemy/restricted-syntax": restrictedSyntax(...CLASSNAME_NO_TEMPLATE, ...AGGREGATE_NO_DIRECT_MUTATION),
    },
  },
];
