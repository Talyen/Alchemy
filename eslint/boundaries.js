import {
  BARREL_PATTERNS,
  BATTLE_NO_FEATURES,
  BATTLE_NO_FRAMEWORK_PATHS,
  BATTLE_NO_MATH_FLOOR,
  BATTLE_NO_MATH_RANDOM,
  DOMAIN_STORE_PATTERNS,
  GAME_DATA_NO_BATTLE,
  layerImports,
  layerImportsWithPaths,
  LIB_BARREL_PATTERNS,
  LIB_NO_FEATURES,
  LIB_NO_FRAMEWORK_PATHS,
  META_NO_RUN_LOOP,
  ORCHESTRATION_NO_SCREENS,
  restrictedSyntax,
  RUN_LOOP_NO_RUN_SETUP,
  RUN_SETUP_NO_RUN_LOOP,
  SCREENS_NO_ORCHESTRATION,
  UI_NO_SESSION_STORES,
} from "./fragments.js";

/** @type {import("eslint").Linter.Config[]} */
export const BOUNDARY_CONFIGS = [
  // Source files: barrel imports + domain-store facade containment.
  // Later layer blocks must re-include these patterns (flat config replaces the rule).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/alchemy/shared/stores/**"],
    rules: {
      "no-restricted-imports": layerImports(BARREL_PATTERNS, DOMAIN_STORE_PATTERNS),
    },
  },
  {
    files: ["src/features/alchemy/shared/stores/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(BARREL_PATTERNS),
    },
  },

  // lib/ — pure logic: no features imports; keep barrel rules.
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImportsWithPaths(
        LIB_NO_FRAMEWORK_PATHS,
        LIB_BARREL_PATTERNS,
        LIB_NO_FEATURES,
        DOMAIN_STORE_PATTERNS,
      ),
    },
  },

  // game-data — schemas and card definitions only; no battle runtime.
  {
    files: ["src/lib/game-data/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImportsWithPaths(
        LIB_NO_FRAMEWORK_PATHS,
        [{ group: ["@/lib/game-data/*"], message: "Import from @/lib/game-data (barrel) instead of deep paths." }],
        GAME_DATA_NO_BATTLE,
        LIB_NO_FEATURES,
        DOMAIN_STORE_PATTERNS,
      ),
    },
  },

  // Battle engine — no React, Zustand, features, Math.random, or Math.floor.
  // placeholderRng in rng.ts is the only allowed constant RNG in setup/defaults.
  {
    files: ["src/lib/battle/**/*.{ts,tsx}"],
    ignores: ["src/lib/battle/rng.ts"],
    rules: {
      "no-restricted-imports": layerImportsWithPaths(
        BATTLE_NO_FRAMEWORK_PATHS,
        [{ group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." }],
        BATTLE_NO_FEATURES,
        DOMAIN_STORE_PATTERNS,
      ),
      "no-restricted-syntax": restrictedSyntax(...BATTLE_NO_MATH_RANDOM, BATTLE_NO_MATH_FLOOR),
    },
  },
  {
    files: ["src/lib/battle/rng.ts"],
    rules: {
      "no-restricted-imports": layerImportsWithPaths(
        BATTLE_NO_FRAMEWORK_PATHS,
        [{ group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." }],
        BATTLE_NO_FEATURES,
        DOMAIN_STORE_PATTERNS,
      ),
    },
  },

  // run-setup — character/difficulty/draft; must not import run-loop (use shared/run-flow).
  // Screens restack below so non-screen setup code is not treated as a screen.
  {
    files: ["src/features/alchemy/run-setup/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(BARREL_PATTERNS, DOMAIN_STORE_PATTERNS, RUN_SETUP_NO_RUN_LOOP),
    },
  },
  {
    files: ["src/features/alchemy/run-setup/screens/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(
        BARREL_PATTERNS,
        DOMAIN_STORE_PATTERNS,
        RUN_SETUP_NO_RUN_LOOP,
        SCREENS_NO_ORCHESTRATION,
      ),
    },
  },

  // run-loop (general) — must not import run-setup. Screens/battle/navigation restack below.
  {
    files: ["src/features/alchemy/run-loop/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(BARREL_PATTERNS, DOMAIN_STORE_PATTERNS, RUN_LOOP_NO_RUN_SETUP),
    },
  },
  {
    files: ["src/features/alchemy/run-loop/screens/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(
        BARREL_PATTERNS,
        DOMAIN_STORE_PATTERNS,
        RUN_LOOP_NO_RUN_SETUP,
        SCREENS_NO_ORCHESTRATION,
      ),
    },
  },
  {
    files: ["src/features/alchemy/run-loop/battle/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(
        BARREL_PATTERNS,
        DOMAIN_STORE_PATTERNS,
        ORCHESTRATION_NO_SCREENS,
        RUN_LOOP_NO_RUN_SETUP,
      ),
    },
  },
  {
    files: ["src/features/alchemy/run-loop/navigation/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(
        BARREL_PATTERNS,
        DOMAIN_STORE_PATTERNS,
        ORCHESTRATION_NO_SCREENS,
        RUN_LOOP_NO_RUN_SETUP,
      ),
    },
  },

  // Meta — menu/collection/homestead; must not depend on run-loop orchestration.
  // Non-screen meta code does not get screen orchestration bans; meta/screens restacks below
  // because flat config replaces earlier no-restricted-imports.
  {
    files: ["src/features/alchemy/meta/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(BARREL_PATTERNS, DOMAIN_STORE_PATTERNS, META_NO_RUN_LOOP),
    },
  },
  {
    files: ["src/features/alchemy/meta/screens/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(
        BARREL_PATTERNS,
        DOMAIN_STORE_PATTERNS,
        META_NO_RUN_LOOP,
        SCREENS_NO_ORCHESTRATION,
      ),
    },
  },

  // Reusable UI widgets — no run/battle/session store subscriptions (ui-store is OK).
  {
    files: ["src/features/alchemy/shared/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(BARREL_PATTERNS, UI_NO_SESSION_STORES),
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
  },

  // Ban React.lazy on route screens — keep barrel + facade bans.
  {
    files: ["src/app/screen-routes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImportsWithPaths(
        [
          {
            name: "react",
            importNames: ["lazy"],
            message: "Do not use React.lazy on route screens. All screen routes must be loaded statically upfront.",
          },
        ],
        BARREL_PATTERNS,
        DOMAIN_STORE_PATTERNS,
      ),
      "no-restricted-properties": [
        "error",
        {
          object: "React",
          property: "lazy",
          message: "Do not use React.lazy on route screens. All screen routes must be loaded statically upfront.",
        },
      ],
    },
  },
];
