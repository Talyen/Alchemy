import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";
import reactCompiler from "eslint-plugin-react-compiler";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".vite", "Raw Assets", "scratch", "playwright-report", "test-results"] },

  // Base recommended configs
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // React hooks + refresh
  {
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
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

  // Source files: enforce barrel imports instead of deep module paths.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/game-data/*"], message: "Import from @/lib/game-data (barrel) instead of deep paths." },
            { group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." },
            { group: ["@/lib/validation/*"], message: "Import from @/lib/validation (barrel) instead of deep paths." },
            { group: ["@/features/alchemy/shared/screens/*"], message: "Import from @/features/alchemy/shared/screens (barrel) instead of deep paths." },
            { group: ["@/features/alchemy/shared/utils/*"], message: "Import from @/features/alchemy/shared/utils (barrel) instead of deep paths." },
            { group: ["@/features/alchemy/shared/storage/*"], message: "Import from @/features/alchemy/shared/storage (barrel) instead of deep paths." },
          ],
        },
      ],
    },
  },

  // lib/ — pure logic: no features imports; keep barrel rules.
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/game-data/*"], message: "Import from @/lib/game-data (barrel) instead of deep paths." },
            { group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." },
            { group: ["@/lib/validation/*"], message: "Import from @/lib/validation (barrel) instead of deep paths." },
            {
              group: ["@/features/**", "**/features/**"],
              message: "lib/ must not import from features/. Move shared types to lib/.",
            },
          ],
        },
      ],
    },
  },

  // game-data — schemas and card definitions only; no battle runtime.
  {
    files: ["src/lib/game-data/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/game-data/*"], message: "Import from @/lib/game-data (barrel) instead of deep paths." },
            {
              group: ["@/lib/battle", "@/lib/battle/**"],
              message: "game-data must not import battle runtime. Handlers live in lib/battle/effect-handlers/.",
            },
          ],
        },
      ],
    },
  },

  // Battle engine — no React, Zustand, or features.
  {
    files: ["src/lib/battle/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "lib/battle must stay framework-agnostic." },
            { name: "zustand", message: "lib/battle must stay framework-agnostic." },
          ],
          patterns: [
            { group: ["@/lib/battle/*"], message: "Import from @/lib/battle (barrel) instead of deep paths." },
            {
              group: ["@/features/**", "**/features/**"],
              message: "lib/battle must not import from features/.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
          message: "Use state.rng or getBattleRng(state) instead of Math.random() in battle engine code.",
        },
        {
          selector: 'MemberExpression[object.name="Math"][property.name="random"]',
          message: "Use unsafeNonSeededRng from ./rng for placeholder RNG instead of Math.random references.",
        },
      ],
    },
  },

  // Run domain store — only the stores layer may import useRunDomainStore directly.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/alchemy/shared/stores/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
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
          ],
        },
      ],
    },
  },

  // features/alchemy subfolder boundaries — keep orchestration out of screens and vice versa.
  {
    files: ["src/features/alchemy/run-loop/battle/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/alchemy/shared/screens", "@/features/alchemy/shared/screens/*", "**/features/alchemy/screens/**"],
              message: "Battle orchestration must not import screen components. Pass data via controllers/stores.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/features/alchemy/run-loop/navigation/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/alchemy/shared/screens", "@/features/alchemy/shared/screens/*", "**/features/alchemy/screens/**"],
              message: "Navigation flows must not import screen components. Wire screens from app/screen-routes.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/features/alchemy/meta/screens/**/*.{ts,tsx}",
      "src/features/alchemy/run-setup/screens/**/*.{ts,tsx}",
      "src/features/alchemy/run-loop/screens/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
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
              group: [
                "@/features/alchemy/shared/stores/run-domain-store",
              ],
              message: "Screens must not mutate session state directly. Use controller callbacks.",
            },
          ],
        },
      ],
    },
  },

  // Meta — menu/collection/homestead; must not depend on run-loop orchestration.
  {
    files: ["src/features/alchemy/meta/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/run-loop/**", "@/features/alchemy/run-loop/**"],
              message: "Meta layer must not import run-loop. Use shared/ only.",
            },
            {
              group: ["**/run-setup/**"],
              message: "Meta layer must not import run-setup.",
            },
          ],
        },
      ],
    },
  },

  // Reusable UI widgets — no run/battle/session store subscriptions (ui-store is OK).
  {
    files: ["src/features/alchemy/shared/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
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
          ],
        },
      ],
    },
  },

  // Source files: warn on `any` type usage.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // JSX files: ban template-literal className (must use cn()).
  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXAttribute[name.name="className"][value.type="TemplateLiteral"]',
          message: "Use cn() from @/lib/utils for class names instead of template literals.",
        },
        {
          selector: 'JSXAttribute[name.name="className"][value.type="JSXExpressionContainer"] TemplateLiteral',
          message: "Use cn() from @/lib/utils for class names instead of template literals.",
        },
      ],
    },
  },

  // Battle engine rounding: use Math.round() instead of Math.floor() for all math.
  {
    files: ["src/lib/battle/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'CallExpression[callee.object.name="Math"][callee.property.name="floor"]',
          message: "Use Math.round() instead of Math.floor() in battle engine code.",
        },
      ],
    },
  },

  // Allow unused args prefixed with _
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // Test files — relax rules for test-specific patterns
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^(_|describe|it|expect|vi|beforeEach|afterEach)$" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // E2E specs run against preview/production builds — dev-only UI must not be targeted.
  {
    files: ["tests/**/*.spec.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'MemberExpression[property.name="skipCombatBtn"]',
          message:
            "Skip Combat is dev-only. Use winViaCombat(), playCardNamed(), or damage cards; CI e2e runs preview builds.",
        },
        {
          selector: 'CallExpression[callee.property.name="skipCombatToVictory"]',
          message:
            "skipCombatToVictory() is dev-only. Use winViaCombat() or playCardNamed() in preview-safe specs.",
        },
        {
          selector: 'Literal[value="Skip Combat"]',
          message: "Skip Combat is dev-only UI. Do not target it in e2e specs.",
        },
        {
          selector: 'Literal[value="Unlock All"]',
          message: "Unlock All is dev-only UI. Do not target it in e2e specs.",
        },
      ],
    },
  },

  // Animation specs must not disable animations via fastBattle or enableFastMode.
  {
    files: [
      "tests/draw-discard-animations.spec.ts",
      "tests/battle-end-turn-canary.spec.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "./fixtures/e2e",
              message:
                "Animation specs must use @playwright/test directly — fixtures/e2e enables fastBattle/enableFastMode.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: 'CallExpression[callee.name="enableFastMode"]',
          message: "Do not call enableFastMode in animation-focused specs.",
        },
        {
          selector: 'ImportDeclaration[source.value="./fixtures/e2e"]',
          message: "Animation specs must use @playwright/test directly — fixtures/e2e enables fastBattle.",
        },
      ],
    },
  },

  // Ban React.lazy on route screens.
  {
    files: ["src/app/screen-routes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["lazy"],
              message: "Do not use React.lazy on route screens. All screen routes must be loaded statically upfront.",
            },
          ],
        },
      ],
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
    languageOptions: { globals: { console: "readable", process: "readable", require: "readable", module: "readable", __dirname: "readable", __filename: "readable", Buffer: "readable", setTimeout: "readable", clearTimeout: "readable", setInterval: "readable", clearInterval: "readable" } },
    rules: { "@typescript-eslint/no-require-imports": "off", "no-undef": "off" },
  },

  // Screenshot scripts (browser env)
  {
    files: ["screenshot-script.*"],
    languageOptions: { globals: { document: "readable", console: "readable", require: "readable" } },
    rules: { "@typescript-eslint/no-require-imports": "off", "no-undef": "off" },
  },
);
