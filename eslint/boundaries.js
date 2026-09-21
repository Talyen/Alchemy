import {
  BARREL_PATTERNS,
  BATTLE_NO_FEATURES,
  BATTLE_NO_FRAMEWORK_PATHS,
  DOMAIN_STORE_PATTERNS,
  GAME_DATA_NO_BATTLE,
  GAMEPLAY_NO_UNSAFE_RANDOM_PICK,
  layerImports,
  layerImportsWithPaths,
  LIB_BARREL_PATTERNS,
  LIB_NO_FEATURES,
  LIB_NO_FRAMEWORK_PATHS,
  META_NO_RUN_LOOP,
  NO_DIRECT_ASSET_IMPORT,
  ORCHESTRATION_NO_SCREENS,
  RUN_LOOP_NO_RUN_SETUP,
  RUN_SETUP_NO_RUN_LOOP,
  SCREENS_NO_APP_ORCHESTRATION,
  SCREENS_NO_ORCHESTRATION,
  UI_NO_SESSION_STORES,
  WRITE_PORT_PATTERNS,
} from "./fragments.js";

const SOURCE_IMPORT_PATTERNS = [BARREL_PATTERNS, DOMAIN_STORE_PATTERNS, WRITE_PORT_PATTERNS, NO_DIRECT_ASSET_IMPORT];

// Each effective scope composes its full policy once. Flat-config rules replace,
// rather than merge, so no scope relies on an earlier block's restrictions.
function scope(files, patterns = SOURCE_IMPORT_PATTERNS, paths = [], ignores = []) {
  return {
    files,
    ...(ignores.length ? { ignores } : {}),
    rules: { "no-restricted-imports": layerImportsWithPaths(paths, ...patterns) },
  };
}

export function cruiserPathFromGroups(groups) {
  const alias = groups.find((group) => group.startsWith("@/"));
  if (alias) return `^src/${alias.replace(/^@\//, "").replace(/\/\*\*$/, "")}/`;
  const deepGroup = groups.find((group) => group.startsWith("**/")) ?? groups.at(-1);
  if (!deepGroup) return "^src/features/alchemy/";
  const deep = deepGroup
    .replace(/^\*\*\//, "")
    .replace(/\/\*\*$/, "")
    .replace(/^src\/features\/alchemy\/?/, "");
  return `^src/features/alchemy/${deep}/`;
}

export { GAME_DATA_NO_BATTLE, LIB_NO_FEATURES, META_NO_RUN_LOOP, RUN_LOOP_NO_RUN_SETUP, RUN_SETUP_NO_RUN_LOOP };

const COMMAND_ONLY = [
  {
    group: ["**/run-session-write-port", "**/run-session-command", "**/stores/write/**"],
    message: "Presentation and flow adapters call intent-level commands; draft mutation belongs to command owners.",
  },
];
const libPatterns = [
  LIB_BARREL_PATTERNS,
  LIB_NO_FEATURES,
  DOMAIN_STORE_PATTERNS,
  WRITE_PORT_PATTERNS,
  NO_DIRECT_ASSET_IMPORT,
];
const catalogPatterns = [
  [{ group: ["@/lib/game-data/*"], message: "Import from @/lib/game-data (barrel) instead of deep paths." }],
  GAME_DATA_NO_BATTLE,
  LIB_NO_FEATURES,
  DOMAIN_STORE_PATTERNS,
  WRITE_PORT_PATTERNS,
];

export const BOUNDARY_CONFIGS = [
  scope(
    ["src/**/*.{ts,tsx}"],
    SOURCE_IMPORT_PATTERNS,
    [],
    ["src/features/alchemy/shared/stores/**", "src/lib/game-data/assets.generated.ts"],
  ),
  scope(["src/features/alchemy/shared/stores/**/*.{ts,tsx}"], [BARREL_PATTERNS], GAMEPLAY_NO_UNSAFE_RANDOM_PICK),
  scope(["src/lib/**/*.{ts,tsx}"], libPatterns, LIB_NO_FRAMEWORK_PATHS),
  scope(["src/lib/game-data/**/*.{ts,tsx}"], [...catalogPatterns, NO_DIRECT_ASSET_IMPORT], LIB_NO_FRAMEWORK_PATHS),
  scope(
    ["src/lib/battle/**/*.{ts,tsx}"],
    [
      [{ group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." }],
      BATTLE_NO_FEATURES,
      DOMAIN_STORE_PATTERNS,
      WRITE_PORT_PATTERNS,
      NO_DIRECT_ASSET_IMPORT,
    ],
    BATTLE_NO_FRAMEWORK_PATHS,
  ),
  scope(["src/features/alchemy/run-setup/**/*.{ts,tsx}"], [...SOURCE_IMPORT_PATTERNS, RUN_SETUP_NO_RUN_LOOP]),
  scope(
    ["src/features/alchemy/run-setup/screens/**/*.{ts,tsx}"],
    [...SOURCE_IMPORT_PATTERNS, RUN_SETUP_NO_RUN_LOOP, SCREENS_NO_ORCHESTRATION, SCREENS_NO_APP_ORCHESTRATION],
  ),
  scope(["src/features/alchemy/run-loop/**/*.{ts,tsx}"], [...SOURCE_IMPORT_PATTERNS, RUN_LOOP_NO_RUN_SETUP]),
  scope(
    ["src/features/alchemy/run-loop/screens/**/*.{ts,tsx}"],
    [...SOURCE_IMPORT_PATTERNS, RUN_LOOP_NO_RUN_SETUP, SCREENS_NO_ORCHESTRATION, SCREENS_NO_APP_ORCHESTRATION],
  ),
  scope(
    ["src/features/alchemy/run-loop/battle/**/*.{ts,tsx}", "src/features/alchemy/run-loop/navigation/**/*.{ts,tsx}"],
    [...SOURCE_IMPORT_PATTERNS, ORCHESTRATION_NO_SCREENS, RUN_LOOP_NO_RUN_SETUP],
  ),
  scope(["src/features/alchemy/meta/**/*.{ts,tsx}"], [...SOURCE_IMPORT_PATTERNS, META_NO_RUN_LOOP]),
  scope(
    ["src/features/alchemy/meta/screens/**/*.{ts,tsx}"],
    [...SOURCE_IMPORT_PATTERNS, META_NO_RUN_LOOP, SCREENS_NO_ORCHESTRATION, SCREENS_NO_APP_ORCHESTRATION],
  ),
  scope(["src/lib/game-data/assets.generated.ts"], catalogPatterns, LIB_NO_FRAMEWORK_PATHS),
  scope(
    ["src/features/alchemy/shell/**/*.{ts,tsx}", "src/app/playthrough/controller.ts"],
    [...SOURCE_IMPORT_PATTERNS, COMMAND_ONLY],
  ),
  scope(
    [
      "src/features/alchemy/run-loop/run/run-flow-*.ts",
      "src/features/alchemy/run-loop/run/wildwood-gauntlet-flow.ts",
      "src/features/alchemy/run-loop/navigation/mystery-event-navigation.ts",
      "src/features/alchemy/run-loop/navigation/corruption-flow.ts",
      "src/features/alchemy/run-loop/battle/**/*.{ts,tsx}",
    ],
    [...SOURCE_IMPORT_PATTERNS, ORCHESTRATION_NO_SCREENS, RUN_LOOP_NO_RUN_SETUP, COMMAND_ONLY],
  ),
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(LIB_NO_FEATURES, ...SOURCE_IMPORT_PATTERNS, UI_NO_SESSION_STORES),
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
  },
  {
    files: ["src/features/alchemy/shared/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": layerImports(...SOURCE_IMPORT_PATTERNS, UI_NO_SESSION_STORES),
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
        ...SOURCE_IMPORT_PATTERNS,
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
