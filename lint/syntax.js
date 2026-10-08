import {
  AGGREGATE_NO_DIRECT_MUTATION,
  ASSET_BARREL_NO_VALUE_IMPORT_SELECTORS,
  BATTLE_NO_DIRECT_RNG,
  BATTLE_NO_MATH_FLOOR,
  BATTLE_NO_MATH_RANDOM,
  CLASSNAME_NO_TEMPLATE,
  GEAR_NO_OUTER_DISPATCH,
  GAMEPLAY_NO_MATH_RANDOM,
  NO_UNOWNED_CONTEXT_CREATION,
  PREVIEW_NO_DEV_CONTROLS,
  restrictedImports,
  restrictedSyntax,
} from "./fragments.js";
function tsxSyntax(...extras) {
  return restrictedSyntax(...CLASSNAME_NO_TEMPLATE, ...extras);
}

const CONTEXT_PROVIDERS = [
  "src/app/app-screen-chrome-context.tsx",
  "src/features/alchemy/shared/context/card-description-context.tsx",
];

function syntaxBlock(files, ignores, ...fragments) {
  return {
    files,
    ...(ignores ? { ignores } : {}),
    rules: {
      "alchemy/restricted-syntax": restrictedSyntax(...fragments),
    },
  };
}

function tsxBlock(files, ignores, ...fragments) {
  return {
    files,
    ...(ignores ? { ignores } : {}),
    rules: {
      "alchemy/restricted-syntax": tsxSyntax(...fragments),
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
    ignores: ["tests/**/*.spec.ts"],
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

  // Final no-restricted-syntax routing. Flat config replaces rule values, so
  // overlapping path policies must be composed in the same path-specific block.
  // ts/tsx pairs are built with syntaxBlock/tsxBlock so new fragments stay in sync.
  // Order matters: later entries win on overlapping paths, so keep this table in
  // most-general to most-specific order.
  ...[
    {
      make: syntaxBlock,
      files: ["src/**/*.ts"],
      ignores: [
        "src/features/alchemy/shared/stores/**",
        "src/features/alchemy/run-loop/**",
        "src/features/alchemy/shell/**",
        "src/lib/battle/**",
      ],
      extra: [],
    },
    {
      make: tsxBlock,
      files: ["src/**/*.tsx"],
      ignores: [
        "src/features/alchemy/shared/stores/**",
        "src/features/alchemy/run-loop/**",
        "src/features/alchemy/shell/**",
        "src/lib/battle/**",
        ...CONTEXT_PROVIDERS,
      ],
      extra: [],
    },
    {
      make: syntaxBlock,
      files: ["src/lib/battle/**/*.ts"],
      ignores: ["src/lib/battle/battle-setup.ts"],
      extra: [...BATTLE_NO_MATH_RANDOM, ...BATTLE_NO_MATH_FLOOR, ...BATTLE_NO_DIRECT_RNG],
    },
    {
      make: syntaxBlock,
      files: ["src/lib/battle/battle-setup.ts"],
      ignores: undefined,
      extra: [...BATTLE_NO_MATH_RANDOM, ...BATTLE_NO_MATH_FLOOR],
    },
    {
      make: syntaxBlock,
      files: [
        "src/features/alchemy/run-loop/navigation/**/*.ts",
        "src/features/alchemy/run-loop/run/**/*.ts",
        "src/lib/mystery/**/*.ts",
        "src/lib/gear/**/*.ts",
        "src/lib/corruption/**/*.ts",
        "src/lib/game-data/reward-selection.ts",
      ],
      ignores: undefined,
      extra: [...GAMEPLAY_NO_MATH_RANDOM],
    },
    {
      make: tsxBlock,
      files: [
        "src/features/alchemy/run-loop/navigation/**/*.tsx",
        "src/features/alchemy/run-loop/run/**/*.tsx",
        "src/lib/mystery/**/*.tsx",
        "src/lib/gear/**/*.tsx",
        "src/lib/corruption/**/*.tsx",
      ],
      ignores: undefined,
      extra: [...GAMEPLAY_NO_MATH_RANDOM],
    },
    {
      make: tsxBlock,
      files: ["src/lib/battle/**/*.tsx"],
      ignores: undefined,
      extra: [...BATTLE_NO_MATH_RANDOM, ...BATTLE_NO_MATH_FLOOR, ...BATTLE_NO_DIRECT_RNG],
    },
    {
      make: syntaxBlock,
      files: ["src/features/alchemy/run-loop/**/*.ts", "src/features/alchemy/shell/**/*.ts"],
      ignores: undefined,
      extra: [...GEAR_NO_OUTER_DISPATCH],
    },
    {
      make: tsxBlock,
      files: ["src/features/alchemy/run-loop/**/*.tsx", "src/features/alchemy/shell/**/*.tsx"],
      ignores: undefined,
      extra: [...GEAR_NO_OUTER_DISPATCH],
    },
    // These gameplay paths overlap the run-loop dispatch policy above. Compose
    // both here: flat config replaces the complete no-restricted-syntax value.
    {
      make: syntaxBlock,
      files: ["src/features/alchemy/run-loop/navigation/**/*.ts", "src/features/alchemy/run-loop/run/**/*.ts"],
      ignores: undefined,
      extra: [...GAMEPLAY_NO_MATH_RANDOM, ...GEAR_NO_OUTER_DISPATCH],
    },
    {
      make: tsxBlock,
      files: ["src/features/alchemy/run-loop/navigation/**/*.tsx", "src/features/alchemy/run-loop/run/**/*.tsx"],
      ignores: undefined,
      extra: [...GAMEPLAY_NO_MATH_RANDOM, ...GEAR_NO_OUTER_DISPATCH],
    },
  ].map((route) =>
    route.make(
      [...route.files],
      route.ignores ? [...route.ignores] : undefined,
      ...route.extra,
      ...AGGREGATE_NO_DIRECT_MUTATION,
      ...NO_UNOWNED_CONTEXT_CREATION,
    ),
  ),

  // Stores own aggregate access, but may not create providers. Approved providers
  // are exempt only from context creation, not the other TSX conventions.
  syntaxBlock(["src/features/alchemy/shared/stores/**/*.ts"], undefined, ...NO_UNOWNED_CONTEXT_CREATION),
  tsxBlock(["src/features/alchemy/shared/stores/**/*.tsx"], undefined, ...NO_UNOWNED_CONTEXT_CREATION),
  tsxBlock(CONTEXT_PROVIDERS, undefined, ...AGGREGATE_NO_DIRECT_MUTATION),
].map(({ files, ignores, rules }) => ({ files, ...(ignores ? { excludeFiles: ignores } : {}), rules }));
