import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";
import reactCompiler from "eslint-plugin-react-compiler";

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
function restrictedImports({ paths = [], patterns = [] }) {
  const opts = {};
  if (paths.length > 0) opts.paths = paths;
  if (patterns.length > 0) opts.patterns = patterns;
  return ["error", opts];
}

/**
 * @param {...SyntaxSelector} selectors
 * @returns {["error", ...SyntaxSelector[]]}
 */
function restrictedSyntax(...selectors) {
  return ["error", ...selectors];
}

/** @type {ImportPattern[]} */
const BARREL_PATTERNS = [
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
const LIB_NO_FEATURES = [
  {
    group: ["@/features/**", "**/features/**"],
    message: "lib/ must not import from features/. Move shared types to lib/.",
  },
];

/** @type {ImportPattern[]} */
const LIB_BARREL_PATTERNS = [
  {
    group: ["@/lib/game-data/*"],
    allowImportNames: ["hydrateCard", "getOfferableCardPool", "getStandardPotionPool", "isStandardPotionCard"],
    message: "Import from @/lib/game-data (barrel) instead of deep paths.",
  },
  { group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." },
  { group: ["@/lib/validation/*"], message: "Import from @/lib/validation (barrel) instead of deep paths." },
];

/** @type {ImportPattern[]} */
const GAME_DATA_NO_BATTLE = [
  {
    group: ["@/lib/battle", "@/lib/battle/**"],
    message: "game-data must not import battle runtime. Handlers live in lib/battle/effect-handlers/.",
  },
];

/** @type {ImportPath[]} */
const BATTLE_NO_FRAMEWORK_PATHS = [
  { name: "react", message: "lib/battle must stay framework-agnostic." },
  { name: "zustand", message: "lib/battle must stay framework-agnostic." },
];

/** @type {ImportPattern[]} */
const BATTLE_NO_FEATURES = [
  {
    group: ["@/features/**", "**/features/**"],
    message: "lib/battle must not import from features/.",
  },
];

/** @type {ImportPattern[]} */
const DOMAIN_STORE_PATTERNS = [
  {
    group: [
      "**/run-domain-store",
      "@/features/alchemy/shared/stores/run-domain-store",
      "**/run-progress-store",
      "@/features/alchemy/shared/stores/run-progress-store",
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
      "Import run-session-facade hooks, readRunSessionStore/readActiveRunStore/readBattleStore, or run-transitions instead of low-level store modules.",
  },
];

/** @type {ImportPattern[]} */
const ORCHESTRATION_NO_SCREENS = [
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
const SCREENS_NO_ORCHESTRATION = [
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
const META_NO_RUN_LOOP = [
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
const RUN_SETUP_NO_RUN_LOOP = [
  {
    group: ["**/run-loop/**", "@/features/alchemy/run-loop/**"],
    message: "run-setup must not import run-loop. Shared destination/campaign helpers live in shared/run-flow.",
  },
];

/** @type {ImportPattern[]} */
const RUN_LOOP_NO_RUN_SETUP = [
  {
    group: ["**/run-setup/**", "@/features/alchemy/run-setup/**"],
    message: "run-loop must not import run-setup. Depend on shared/run-flow contracts or shell-composed deps.",
  },
];

/** @type {ImportPattern[]} */
const UI_NO_SESSION_STORES = [
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
const BATTLE_NO_MATH_RANDOM = [
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
const BATTLE_NO_MATH_FLOOR = {
  selector: 'CallExpression[callee.object.name="Math"][callee.property.name="floor"]',
  message: "Use Math.round() instead of Math.floor() in battle engine code.",
};

/** @type {SyntaxSelector[]} */
const CLASSNAME_NO_TEMPLATE = [
  {
    selector: 'JSXAttribute[name.name="className"][value.type="TemplateLiteral"]',
    message: "Use cn() from @/lib/utils for class names instead of template literals.",
  },
  {
    selector: 'JSXAttribute[name.name="className"][value.type="JSXExpressionContainer"] TemplateLiteral',
    message: "Use cn() from @/lib/utils for class names instead of template literals.",
  },
];

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

  // Source files: barrel imports + domain-store facade containment.
  // Later layer blocks must re-include these patterns (flat config replaces the rule).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/alchemy/shared/stores/**"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...BARREL_PATTERNS, ...DOMAIN_STORE_PATTERNS],
      }),
    },
  },
  {
    files: ["src/features/alchemy/shared/stores/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: BARREL_PATTERNS,
      }),
    },
  },

  // lib/ — pure logic: no features imports; keep barrel rules.
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...LIB_BARREL_PATTERNS, ...LIB_NO_FEATURES, ...DOMAIN_STORE_PATTERNS],
      }),
    },
  },

  // game-data — schemas and card definitions only; no battle runtime.
  {
    files: ["src/lib/game-data/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [
          { group: ["@/lib/game-data/*"], message: "Import from @/lib/game-data (barrel) instead of deep paths." },
          ...GAME_DATA_NO_BATTLE,
          ...LIB_NO_FEATURES,
          ...DOMAIN_STORE_PATTERNS,
        ],
      }),
    },
  },

  // Battle engine — no React, Zustand, features, Math.random, or Math.floor.
  // rng.ts is the sole allowed Math.random binding site (unsafeNonSeededRng).
  {
    files: ["src/lib/battle/**/*.{ts,tsx}"],
    ignores: ["src/lib/battle/rng.ts"],
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: BATTLE_NO_FRAMEWORK_PATHS,
        patterns: [
          { group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." },
          ...BATTLE_NO_FEATURES,
          ...DOMAIN_STORE_PATTERNS,
        ],
      }),
      "no-restricted-syntax": restrictedSyntax(...BATTLE_NO_MATH_RANDOM, BATTLE_NO_MATH_FLOOR),
    },
  },
  {
    files: ["src/lib/battle/rng.ts"],
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: BATTLE_NO_FRAMEWORK_PATHS,
        patterns: [
          { group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." },
          ...BATTLE_NO_FEATURES,
          ...DOMAIN_STORE_PATTERNS,
        ],
      }),
    },
  },

  // features/alchemy subfolder boundaries — keep orchestration out of screens and vice versa.
  {
    files: [
      "src/features/alchemy/meta/screens/**/*.{ts,tsx}",
      "src/features/alchemy/run-setup/screens/**/*.{ts,tsx}",
      "src/features/alchemy/run-loop/screens/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...BARREL_PATTERNS, ...DOMAIN_STORE_PATTERNS, ...SCREENS_NO_ORCHESTRATION],
      }),
    },
  },

  // run-setup — character/difficulty/draft; must not import run-loop (use shared/run-flow).
  // Screens restack below so non-screen setup code is not treated as a screen.
  {
    files: ["src/features/alchemy/run-setup/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...BARREL_PATTERNS, ...DOMAIN_STORE_PATTERNS, ...RUN_SETUP_NO_RUN_LOOP],
      }),
    },
  },
  {
    files: ["src/features/alchemy/run-setup/screens/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...BARREL_PATTERNS, ...DOMAIN_STORE_PATTERNS, ...RUN_SETUP_NO_RUN_LOOP, ...SCREENS_NO_ORCHESTRATION],
      }),
    },
  },

  // run-loop (general) — must not import run-setup. Screens/battle/navigation restack below.
  {
    files: ["src/features/alchemy/run-loop/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...BARREL_PATTERNS, ...DOMAIN_STORE_PATTERNS, ...RUN_LOOP_NO_RUN_SETUP],
      }),
    },
  },
  {
    files: ["src/features/alchemy/run-loop/screens/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...BARREL_PATTERNS, ...DOMAIN_STORE_PATTERNS, ...RUN_LOOP_NO_RUN_SETUP, ...SCREENS_NO_ORCHESTRATION],
      }),
    },
  },

  {
    files: ["src/features/alchemy/run-loop/battle/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...BARREL_PATTERNS, ...DOMAIN_STORE_PATTERNS, ...ORCHESTRATION_NO_SCREENS, ...RUN_LOOP_NO_RUN_SETUP],
      }),
    },
  },
  {
    files: ["src/features/alchemy/run-loop/navigation/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...BARREL_PATTERNS, ...DOMAIN_STORE_PATTERNS, ...ORCHESTRATION_NO_SCREENS, ...RUN_LOOP_NO_RUN_SETUP],
      }),
    },
  },

  // Meta — menu/collection/homestead; must not depend on run-loop orchestration.
  // Includes screen orchestration bans because meta/screens also match this glob
  // and flat config replaces earlier screen-layer no-restricted-imports.
  {
    files: ["src/features/alchemy/meta/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...BARREL_PATTERNS, ...DOMAIN_STORE_PATTERNS, ...META_NO_RUN_LOOP, ...SCREENS_NO_ORCHESTRATION],
      }),
    },
  },

  // Reusable UI widgets — no run/battle/session store subscriptions (ui-store is OK).
  {
    files: ["src/features/alchemy/shared/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        patterns: [...BARREL_PATTERNS, ...UI_NO_SESSION_STORES],
      }),
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
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

  // Ban React.lazy on route screens — keep barrel + facade bans.
  {
    files: ["src/app/screen-routes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: [
          {
            name: "react",
            importNames: ["lazy"],
            message: "Do not use React.lazy on route screens. All screen routes must be loaded statically upfront.",
          },
        ],
        patterns: [...BARREL_PATTERNS, ...DOMAIN_STORE_PATTERNS],
      }),
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
