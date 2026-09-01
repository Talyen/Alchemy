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
  NO_DIRECT_ASSET_IMPORT,
  ORCHESTRATION_NO_SCREENS,
  restrictedSyntax,
  RUN_LOOP_NO_RUN_SETUP,
  RUN_SETUP_NO_RUN_LOOP,
  SCREENS_NO_ORCHESTRATION,
  UI_NO_SESSION_STORES,
  WRITE_PORT_PATTERNS,
} from "./fragments.js";

function boundaryBlock(files, ...extra) {
  return {
    files,
    rules: {
      "no-restricted-imports": layerImports(BARREL_PATTERNS, DOMAIN_STORE_PATTERNS, ...extra),
    },
  };
}

function boundaryBlockWithIgnores(files, ignores, ...extra) {
  return {
    files,
    ignores,
    rules: {
      "no-restricted-imports": layerImports(BARREL_PATTERNS, DOMAIN_STORE_PATTERNS, ...extra),
    },
  };
}

export function cruiserPathFromGroups(groups) {
  const alias = groups.find((group) => group.startsWith("@/"));
  if (alias) return `^src/${alias.replace(/^@\//, "").replace(/\/\*\*$/, "")}/`;
  const deepGroup = groups.find((group) => group.startsWith("**/")) ?? groups.at(-1);
  if (!deepGroup) return "^src/features/alchemy/";
  const deep = deepGroup.replace(/^\*\*\//, "").replace(/\/\*\*$/, "");
  return `^src/features/alchemy/${deep}/`;
}

export { LIB_NO_FEATURES, META_NO_RUN_LOOP, RUN_LOOP_NO_RUN_SETUP, RUN_SETUP_NO_RUN_LOOP };

const BOUNDARY_TABLE = [
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/alchemy/shared/stores/**", "src/lib/game-data/assets.generated.ts"],
    extra: [WRITE_PORT_PATTERNS, NO_DIRECT_ASSET_IMPORT],
  },
  { files: ["src/features/alchemy/shared/stores/**/*.{ts,tsx}"], onlyBarrel: true },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    paths: LIB_NO_FRAMEWORK_PATHS,
    patterns: [LIB_BARREL_PATTERNS, LIB_NO_FEATURES, DOMAIN_STORE_PATTERNS],
  },
  {
    files: ["src/lib/game-data/**/*.{ts,tsx}"],
    paths: LIB_NO_FRAMEWORK_PATHS,
    patterns: [
      [{ group: ["@/lib/game-data/*"], message: "Import from @/lib/game-data (barrel) instead of deep paths." }],
      GAME_DATA_NO_BATTLE,
      LIB_NO_FEATURES,
      DOMAIN_STORE_PATTERNS,
    ],
  },
  {
    files: ["src/lib/battle/**/*.{ts,tsx}"],
    ignores: ["src/lib/battle/rng.ts"],
    paths: BATTLE_NO_FRAMEWORK_PATHS,
    patterns: [
      [{ group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." }],
      BATTLE_NO_FEATURES,
      DOMAIN_STORE_PATTERNS,
    ],
    syntax: [BATTLE_NO_MATH_RANDOM, BATTLE_NO_MATH_FLOOR],
  },
  {
    files: ["src/lib/battle/rng.ts"],
    paths: BATTLE_NO_FRAMEWORK_PATHS,
    patterns: [
      [{ group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." }],
      BATTLE_NO_FEATURES,
      DOMAIN_STORE_PATTERNS,
    ],
  },
  { files: ["src/features/alchemy/run-setup/**/*.{ts,tsx}"], extra: [RUN_SETUP_NO_RUN_LOOP] },
  {
    files: ["src/features/alchemy/run-setup/screens/**/*.{ts,tsx}"],
    extra: [RUN_SETUP_NO_RUN_LOOP, SCREENS_NO_ORCHESTRATION],
  },
  { files: ["src/features/alchemy/run-loop/**/*.{ts,tsx}"], extra: [RUN_LOOP_NO_RUN_SETUP] },
  {
    files: ["src/features/alchemy/run-loop/screens/**/*.{ts,tsx}"],
    extra: [RUN_LOOP_NO_RUN_SETUP, SCREENS_NO_ORCHESTRATION],
  },
  {
    files: ["src/features/alchemy/run-loop/battle/**/*.{ts,tsx}"],
    extra: [ORCHESTRATION_NO_SCREENS, RUN_LOOP_NO_RUN_SETUP],
  },
  {
    files: ["src/features/alchemy/run-loop/navigation/**/*.{ts,tsx}"],
    extra: [ORCHESTRATION_NO_SCREENS, RUN_LOOP_NO_RUN_SETUP],
  },
  { files: ["src/features/alchemy/meta/**/*.{ts,tsx}"], extra: [META_NO_RUN_LOOP] },
  {
    files: ["src/features/alchemy/meta/screens/**/*.{ts,tsx}"],
    extra: [META_NO_RUN_LOOP, SCREENS_NO_ORCHESTRATION],
  },
];

function createBoundaryConfig(entry) {
  if (entry.onlyBarrel) {
    return {
      files: entry.files,
      rules: {
        "no-restricted-imports": layerImports(BARREL_PATTERNS),
      },
    };
  }
  if (entry.paths) {
    return {
      files: entry.files,
      ...(entry.ignores ? { ignores: entry.ignores } : {}),
      rules: {
        "no-restricted-imports": layerImportsWithPaths(entry.paths, ...entry.patterns),
        ...(entry.syntax ? { "no-restricted-syntax": restrictedSyntax(...entry.syntax.flat()) } : {}),
      },
    };
  }
  return entry.ignores
    ? boundaryBlockWithIgnores(entry.files, entry.ignores, ...entry.extra)
    : boundaryBlock(entry.files, ...entry.extra);
}

const BOUNDARY_TABLE_CONFIGS = BOUNDARY_TABLE.map(createBoundaryConfig);

export const BOUNDARY_CONFIGS = [
  ...BOUNDARY_TABLE_CONFIGS,
  {
    files: ["src/features/alchemy/shared/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(BARREL_PATTERNS, UI_NO_SESSION_STORES),
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
  },
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
