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
    group: ["@/lib/game-data/*"],
    allowImportNames: ["hydrateCard", "getOfferableCardPool", "getStandardPotionPool", "isStandardPotionCard"],
    message: "Import from @/lib/game-data (barrel) instead of deep paths.",
  },
  { group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." },
  { group: ["@/lib/validation/*"], message: "Import from @/lib/validation (barrel) instead of deep paths." },
  {
    group: ["@/features/alchemy/shared/utils/*"],
    message: "Import from @/features/alchemy/shared/utils (barrel) instead of deep paths.",
  },
  {
    group: ["@/features/alchemy/shared/storage/*"],
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

/** @type {ImportPattern[]} */
export const LIB_BARREL_PATTERNS = [
  {
    group: ["@/lib/game-data/*"],
    allowImportNames: ["hydrateCard", "getOfferableCardPool", "getStandardPotionPool", "isStandardPotionCard"],
    message: "Import from @/lib/game-data (barrel) instead of deep paths.",
  },
  { group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." },
  { group: ["@/lib/validation/*"], message: "Import from @/lib/validation (barrel) instead of deep paths." },
];

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
      "**/run-domain-store",
      "@/features/alchemy/shared/stores/run-domain-store",
      "**/run-progress-store",
      "@/features/alchemy/shared/stores/run-progress-store",
      "**/run-profile-store",
      "@/features/alchemy/shared/stores/run-profile-store",
      "**/run-transient-store",
      "@/features/alchemy/shared/stores/run-transient-store",
      "**/run-battle-domain-store",
      "@/features/alchemy/shared/stores/run-battle-domain-store",
      "**/run-transitions",
      "@/features/alchemy/shared/stores/run-transitions",
      "**/stores/ports/*",
      "@/features/alchemy/shared/stores/ports/*",
      "**/run-domain-types",
      "**/run-session-store",
      "@/features/alchemy/shared/stores/run-session-store",
      "**/stores/battle-store",
      "@/features/alchemy/shared/stores/battle-store",
      "**/stores/store-access",
      "@/features/alchemy/shared/stores/store-access",
      "**/run-lifecycle-coordinator",
      "@/features/alchemy/shared/stores/run-lifecycle-coordinator",
      "**/run-store-sync",
      "@/features/alchemy/shared/stores/run-store-sync",
    ],
    message:
      "Import a capability-specific run-session port instead of low-level run stores, ports, or run-transitions.",
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
      "@/features/alchemy/run-loop/battle/*",
      "**/features/alchemy/run-loop/battle/**",
    ],
    message: "Screens must not import battle orchestration. Use controller props and @/lib/battle types.",
  },
  {
    group: [
      "@/features/alchemy/run-loop/navigation",
      "@/features/alchemy/run-loop/navigation/*",
      "**/features/alchemy/run-loop/navigation/**",
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
      "**/stores/run-session-facade",
      "**/stores/run-session-actions",
      "**/stores/run-session-read",
      "@/features/alchemy/shared/stores/run-domain-store",
      "@/features/alchemy/shared/stores/battle-store",
      "@/features/alchemy/shared/stores/run-session-facade",
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
      "Reference to Math.random is not allowed in the battle engine. Use state.rng for seeded RNG during combat, or unsafeNonSeededRng from ./rng only in setup/defaults paths.",
  },
];

/** @type {SyntaxSelector} */
export const BATTLE_NO_MATH_FLOOR = {
  selector: 'CallExpression[callee.object.name="Math"][callee.property.name="floor"]',
  message: "Use Math.round() instead of Math.floor() in battle engine code.",
};

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
