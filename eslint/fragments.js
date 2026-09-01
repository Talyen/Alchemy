// ── Restricted-import / syntax fragments ─────────────────────────────────────
// Flat config replaces no-restricted-imports / no-restricted-syntax per block.
// Compose unions explicitly so later layer blocks do not wipe earlier bans.

/** @typedef {{ group: string | string[], message: string, allowImportNames?: string[] }} ImportPattern */
/** @typedef {{ name: string, message: string, importNames?: string[] }} ImportPath */
/** @typedef {{ selector: string, message: string }} SyntaxSelector */

/**
 * @param {{ paths?: ImportPath[], patterns?: ImportPattern[] }} opts
 * @returns {["error", { paths?: ImportPath[], patterns?: ImportPattern[] }]}
 */
export function restrictedImports({ paths = [], patterns = [] }) {
  const opts = {};
  if (paths.length > 0) opts.paths = paths;
  if (patterns.length > 0) opts.patterns = patterns;
  return ["error", opts];
}

/**
 * @param {...SyntaxSelector} selectors
 * @returns {["error", ...SyntaxSelector[]]}
 */
export function restrictedSyntax(...selectors) {
  return ["error", ...selectors];
}

/** Always compose layer fragments explicitly — flat config replaces no-restricted-imports. */
export function layerImports(...fragments) {
  return restrictedImports({ patterns: fragments.flat() });
}

export function layerImportsWithPaths(paths, ...fragments) {
  return restrictedImports({ paths, patterns: fragments.flat() });
}

/** @type {ImportPattern[]} */
export const BARREL_PATTERNS = [
  {
    group: ["@/lib/game-data/*", "**/lib/game-data/*"],
    allowImportNames: ["hydrateCard", "getOfferableCardPool", "getStandardPotionPool", "isStandardPotionCard"],
    message: "Import from @/lib/game-data (barrel) instead of deep paths.",
  },
  { group: ["@/lib/battle/*", "**/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." },
  {
    group: ["@/lib/validation/*", "**/lib/validation/*"],
    message: "Import from @/lib/validation (barrel) instead of deep paths.",
  },
  {
    group: ["@/features/alchemy/shared/utils/*", "**/features/alchemy/shared/utils/*"],
    message: "Import from @/features/alchemy/shared/utils (barrel) instead of deep paths.",
  },
  {
    group: ["@/features/alchemy/shared/storage/*", "**/features/alchemy/shared/storage/*"],
    allowImportNames: [
      "flushAlchemySaveNow",
      "buildAlchemySaveDataFromStores",
      "bootstrapAlchemySaveState",
      "applySaveDataToStores",
    ],
    message: "Import from @/features/alchemy/shared/storage (barrel) instead of deep paths.",
  },
];

/** @type {ImportPattern[]} */
export const LIB_NO_FEATURES = [
  {
    group: ["@/features/**", "**/features/**"],
    message: "lib/ must not import from features/. Move shared types to lib/.",
  },
];

/** @type {ImportPattern[]} — subset of BARREL_PATTERNS relevant inside src/lib (no features barrels). */
export const LIB_BARREL_PATTERNS = BARREL_PATTERNS.filter((pattern) =>
  pattern.group.some((g) => g.includes("@/lib/") || g.includes("/lib/")),
);

/** @type {ImportPattern[]} */
export const GAME_DATA_NO_BATTLE = [
  {
    group: ["@/lib/battle", "@/lib/battle/**"],
    message: "game-data must not import battle runtime. Handlers live in lib/battle/effect-handlers/.",
  },
];

/** @type {ImportPath[]} */
export const BATTLE_NO_FRAMEWORK_PATHS = [
  { name: "react", message: "lib/battle must stay framework-agnostic." },
  { name: "zustand", message: "lib/battle must stay framework-agnostic." },
  { name: "lucide-react", message: "src/lib must stay React-free. Map icon ids in features." },
];

/** @type {ImportPath[]} */
export const LIB_NO_FRAMEWORK_PATHS = [
  { name: "react", message: "src/lib must stay React-free." },
  { name: "react-dom", message: "src/lib must stay React-free." },
  { name: "lucide-react", message: "src/lib must stay React-free. Map icon ids in features." },
];

/** @type {ImportPattern[]} */
export const BATTLE_NO_FEATURES = [
  {
    group: ["@/features/**", "**/features/**"],
    message: "lib/battle must not import from features/.",
  },
];

/** @type {ImportPattern[]} */
export const DOMAIN_STORE_PATTERNS = [
  {
    group: [
      "**/gameplay-state-store",
      "@/features/alchemy/shared/stores/gameplay-state-store",
      "**/run-lifecycle",
      "@/features/alchemy/shared/stores/run-lifecycle",
      "**/run-presentation-lifecycle",
      "@/features/alchemy/shared/stores/run-presentation-lifecycle",
    ],
    message:
      "Import a capability-specific run-session port instead of the low-level gameplay aggregate or lifecycle internals.",
  },
];

/** @type {ImportPattern[]} */
export const WRITE_PORT_PATTERNS = [
  {
    group: [
      "**/write-port-run",
      "@/features/alchemy/shared/stores/write-port-run",
      "**/write-port-session",
      "@/features/alchemy/shared/stores/write-port-session",
    ],
    message:
      "Import from @/features/alchemy/shared/stores/run-session-write-port instead of write-port internals — outside shared/stores/* the barrel is the canonical seam.",
  },
];

/** @type {ImportPattern[]} */
export const ORCHESTRATION_NO_SCREENS = [
  {
    group: [
      "@/features/alchemy/meta/screens",
      "@/features/alchemy/meta/screens/*",
      "@/features/alchemy/meta/screens/**",
      "**/features/alchemy/meta/screens/**",
      "@/features/alchemy/run-setup/screens",
      "@/features/alchemy/run-setup/screens/*",
      "@/features/alchemy/run-setup/screens/**",
      "**/features/alchemy/run-setup/screens/**",
      "@/features/alchemy/run-loop/screens",
      "@/features/alchemy/run-loop/screens/*",
      "@/features/alchemy/run-loop/screens/**",
      "**/features/alchemy/run-loop/screens/**",
      "**/features/alchemy/screens/**",
    ],
    message: "Orchestration must not import screen components. Wire screens from app/screen-routes.",
  },
];

/** @type {ImportPattern[]} */
export const SCREENS_NO_ORCHESTRATION = [
  {
    group: [
      "@/features/alchemy/run-loop/battle",
      "@/features/alchemy/run-loop/battle/!(presentation)",
      "@/features/alchemy/run-loop/battle/!(presentation)/**",
      "**/features/alchemy/run-loop/battle/!(presentation)",
      "**/features/alchemy/run-loop/battle/!(presentation)/**",
      "../battle/!(presentation)",
      "../battle/!(presentation)/**",
      "../../battle/!(presentation)",
      "../../battle/!(presentation)/**",
    ],
    message: "Screens must not import battle orchestration. Use controller props and @/lib/battle types.",
  },
  {
    group: [
      "@/features/alchemy/run-loop/navigation",
      "@/features/alchemy/run-loop/navigation/*",
      "**/features/alchemy/run-loop/navigation/**",
      "../navigation",
      "../navigation/*",
      "../navigation/**",
      "../../navigation",
      "../../navigation/*",
      "../../navigation/**",
    ],
    message: "Screens must not import navigation flows. Wire handlers from app/screen-routes.",
  },
  {
    group: [
      "@/features/alchemy/run",
      "@/features/alchemy/run/*",
      "**/features/alchemy/run/**",
      "**/features/alchemy/run-loop/run/**",
      "**/features/alchemy/run-setup/run/**",
      "../run",
      "../run/*",
      "../run/**",
      "../../run",
      "../../run/*",
      "../../run/**",
    ],
    message: "Screens must not import run orchestration. Pass data via controller props.",
  },
  {
    group: ["@/features/alchemy/shared/stores/run-domain-store"],
    message: "Screens must not mutate session state directly. Use controller callbacks.",
  },
];

/** @type {ImportPattern[]} */
export const META_NO_RUN_LOOP = [
  {
    group: ["**/run-loop/**", "@/features/alchemy/run-loop/**"],
    message: "Meta layer must not import run-loop. Import phase screen barrels or shared/ only.",
  },
  {
    group: ["**/run-setup/**"],
    message: "Meta layer must not import run-setup.",
  },
];

/** @type {ImportPattern[]} */
export const RUN_SETUP_NO_RUN_LOOP = [
  {
    group: ["**/run-loop/**", "@/features/alchemy/run-loop/**"],
    message: "run-setup must not import run-loop. Shared destination/campaign helpers live in shared/run-flow.",
  },
];

/** @type {ImportPattern[]} */
export const RUN_LOOP_NO_RUN_SETUP = [
  {
    group: ["**/run-setup/**", "@/features/alchemy/run-setup/**"],
    message: "run-loop must not import run-setup. Depend on shared/run-flow contracts or shell-composed deps.",
  },
];

/** @type {ImportPattern[]} */
export const UI_NO_SESSION_STORES = [
  {
    group: [
      "**/stores/run-domain-store",
      "**/stores/battle-store",
      "**/stores/run-session-actions",
      "**/stores/run-session-read",
      "**/stores/run-session-*",
      "**/stores/run-reads",
      "@/features/alchemy/shared/stores/run-domain-store",
      "@/features/alchemy/shared/stores/battle-store",
      "@/features/alchemy/shared/stores/run-session-read-port",
      "@/features/alchemy/shared/stores/run-session-write-port",
      "@/features/alchemy/shared/stores/run-session-react-ports",
      "@/features/alchemy/shared/stores/run-reads",
      "@/features/alchemy/shared/stores/gameplay-state-store",
    ],
    message: "UI widgets receive data via props. Only ui-store is allowed for ephemeral hover/shimmer.",
  },
];

/** @type {SyntaxSelector[]} */
export const BATTLE_NO_MATH_RANDOM = [
  {
    selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
    message: "Use state.rng or getBattleRng(state) instead of Math.random() in battle engine code.",
  },
  {
    selector: 'MemberExpression[object.name="Math"][property.name="random"]',
    message:
      "Reference to Math.random is not allowed in the battle engine. Use state.rng or getBattleRng(state) for seeded combat RNG; placeholderRng from ./rng is only for UI-default battle snapshots.",
  },
];

/** @type {SyntaxSelector} */
export const BATTLE_NO_MATH_FLOOR = {
  selector: 'CallExpression[callee.object.name="Math"][callee.property.name="floor"]',
  message: "Use Math.round() instead of Math.floor() in battle engine code.",
};

/** @type {SyntaxSelector} */
export const BATTLE_NO_DIRECT_RNG = {
  selector: 'MemberExpression[object.name="state"][property.name="rng"]',
  message: "Use getBattleRng(state) instead of state.rng in battle engine code.",
};

/** @type {SyntaxSelector[]} */
export const AGGREGATE_NO_DIRECT_MUTATION = [
  {
    selector: 'MemberExpression[object.name="useGameplayStateStore"][property.name="getState"]',
    message:
      "Use capability ports (run-session-read-port / run-session-write-port) + dispatchRunSessionCommand instead of useGameplayStateStore.getState() — see .agents/knowledge/patterns/run-state-command-boundary.md.",
  },
  {
    selector: 'MemberExpression[object.name="useGameplayStateStore"][property.name="setState"]',
    message:
      "Use dispatchRunSessionCommand + draft mutators instead of useGameplayStateStore.setState() — see .agents/knowledge/patterns/run-state-command-boundary.md.",
  },
];

/** @type {SyntaxSelector[]} */
export const GEAR_NO_OUTER_DISPATCH = [
  {
    selector:
      'ImportDeclaration[source.value=/gear-session-command/] ImportSpecifier[imported.name="dispatchGearMutationWithRunHealthSync"]',
    message:
      "Use mutateGearWithRunHealthSync(draft, ...) inside a run-session command — outer dispatch nests commands — see .agents/knowledge/patterns/gear-hp-sync.md.",
  },
  {
    selector:
      'ImportDeclaration[source.value=/gear-session-command/] ImportSpecifier[imported.name="dispatchGearSalvageWithMaterialGrant"]',
    message:
      "Use mutateGearWithRunHealthSync(draft, ...) + grantMaterials(draft, ...) inside a run-session command — outer salvage dispatch nests commands — see .agents/knowledge/patterns/gear-hp-sync.md.",
  },
];

/** @type {SyntaxSelector[]} */
export const CLASSNAME_NO_TEMPLATE = [
  {
    selector: 'JSXAttribute[name.name="className"][value.type="TemplateLiteral"]',
    message: "Use cn() from @/lib/utils for class names instead of template literals.",
  },
  {
    selector: 'JSXAttribute[name.name="className"][value.type="JSXExpressionContainer"] TemplateLiteral',
    message: "Use cn() from @/lib/utils for class names instead of template literals.",
  },
];

/** Direct @/assets/optimized imports bypass the generated barrel — use @/lib/game-data barrels instead. */
export const NO_DIRECT_ASSET_IMPORT = [
  {
    group: ["@/assets/optimized", "@/assets/optimized/*", "**/assets/optimized/*"],
    message:
      "Import art via @/lib/game-data (e.g. difficultyArt/craftingArt/characterArt) instead of @/assets/optimized directly. The barrel is the canonical import surface.",
  },
];

/** Playwright esbuild cannot parse .webp barrels — flag value imports only. */
export const ASSET_BARREL_NO_VALUE_IMPORT_REASONS = {
  "@/lib/game-data": "its barrel re-exports .webp assets esbuild can't parse. Use `import type` or a safe deep import.",
  "@/lib/gear":
    "it re-exports crafting.ts which imports .webp assets esbuild can't parse. Use `import type` or a safe deep import.",
};

export const ASSET_BARREL_NO_VALUE_IMPORT_SELECTORS = Object.entries(ASSET_BARREL_NO_VALUE_IMPORT_REASONS).map(
  ([source, reason]) => ({
    selector: `ImportDeclaration[source.value="${source}"]:not([importKind="type"])`,
    message: `Playwright-collected tests must not value-import ${source} — ${reason}`,
  }),
);

/** Ban .only and focused tests on test suites so CI never silently skips tests. */
export const TESTS_NO_ONLY_SELECTORS = [
  {
    selector: 'CallExpression[callee.property.name="only"][callee.object.name=/(describe|it|test|suite)/]',
    message: "Do not commit .only in tests; keep all tests active.",
  },
  {
    selector:
      'CallExpression[callee.property.name="only"][callee.object.property.name=/(describe|it|test|suite|concurrent|serial)/]',
    message: "Do not commit .only in tests; keep all tests active.",
  },
  {
    selector: 'MemberExpression[property.name="only"][object.name=/(describe|it|test|suite)/]',
    message: "Do not commit .only in tests; keep all tests active.",
  },
  {
    selector:
      'MemberExpression[property.name="only"][object.property.name=/(describe|it|test|suite|concurrent|serial)/]',
    message: "Do not commit .only in tests; keep all tests active.",
  },
  {
    selector: 'CallExpression[callee.name="fit"]',
    message: "Do not commit fit in tests; keep all tests active.",
  },
  {
    selector: 'CallExpression[callee.name="fdescribe"]',
    message: "Do not commit fdescribe in tests; keep all tests active.",
  },
];

/** Banned creation of React contexts outside designated provider seams. */
export const NO_UNOWNED_CONTEXT_CREATION = [
  {
    selector: 'CallExpression[callee.name="createContext"]',
    message:
      "Do not create React Contexts here. Allowed providers are AppScreenChromeProvider and CardDescriptionProvider; pass controllers via route/shell props.",
  },
  {
    selector: 'CallExpression[callee.object.name="React"][callee.property.name="createContext"]',
    message:
      "Do not create React Contexts here. Allowed providers are AppScreenChromeProvider and CardDescriptionProvider; pass controllers via route/shell props.",
  },
];
