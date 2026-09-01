/**
 * Knip dead-code policy
 * ---------------------
 * Barrels for `@/lib/game-data`, `@/lib/battle`, and `@/lib/validation` are the
 * eslint-enforced public surface. Feature stores and screens still use on-disk
 * paths (`shared/run-flow/destination-flow`).
 *
 * Prefer removing unused exports over growing `ignoreIssues`.
 * Entries listed under `ignoreIssues` must be intentional seams, generated
 * catalogs, or compatibility re-exports — each with a short reason.
 *
 * `npm run deadcode` — CI / `lint:ci`; not default pre-push.
 * `npm run deadcode:strict` — nightly; entry exports + config hints. Strict
 * production analysis excludes dependency/unlisted classes that cannot trace
 * the Vite/Electron graph reliably.
 */
export default {
  entry: [
    "src/lib/game-data/index.ts",
    "src/lib/game-constants/index.ts",
    "src/lib/gear/index.ts",
    "src/lib/battle/index.ts",
    "src/lib/validation/index.ts",
    "src/features/alchemy/shared/run-flow/index.ts",
    "scripts/*.mjs",
    "desktop/*.cjs",
  ],
  project: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs", "desktop/**/*.cjs", "tests/**/*.{ts,tsx}"],
  ignoreIssues: {
    // Compatibility barrel for active-run persistence types + serializers.
    "src/lib/active-run-session/index.ts": ["exports", "types"],
    "src/lib/gear/types.ts": ["exports", "types"],
    "scripts/lib/git-release.mjs": ["exports"],
    "scripts/lib/patch-notes-core.mjs": ["exports"],
    "src/lib/routing/destinations.ts": ["exports"],
    "src/lib/routing/index.ts": ["exports"],
    "src/lib/routing/run-screen-router.ts": ["exports"],
    "src/app/screen-routes/index.tsx": ["types"],
    "src/lib/validation/migration/tombstoned-content-ids.ts": ["exports", "types"],
    // Shared active-run orchestration contract enforced by architecture tests; consumed via Pick aliases.
    "src/features/alchemy/shared/stores/run-port-types.ts": ["types"],
    "src/features/alchemy/shell/shell-types.ts": ["types"],
    // Unified persistence seam: single source in persistence.ts (compat shims removed). Duplicate is deprecated alias.
    "src/features/alchemy/shared/storage/persistence.ts": ["exports", "types", "duplicates"],
    // Orchestration port is consumed via type-level architecture contract; knip cannot trace test-d import when file is ignored.
    "src/features/alchemy/shared/stores/run-session-react-ports.ts": ["exports"],
    // Semantic alias: corruption weight mirrors default for now, intentional duplicate.
    "src/lib/game-constants/run-rewards.ts": ["duplicates"],
    // Compat barrel: talentPool is single source, per-keyword arrays are filtered views for legacy imports.
    "src/lib/game-data/talents/pool/index.ts": ["exports"],
    // Backward-compat re-exports for verify:changed consumers; canonical source is scripts/lib/test-commands.mjs.
    "scripts/lib/change-routes.mjs": ["exports"],
    "src/lib/game-data/effects/shared-schemas.ts": ["exports"],
    "src/lib/game-data/effects/simple-schemas.ts": ["exports"],
    // Shared Vite alias / SSR list — consumed by vite.config.ts and vitest.config.ts sync guard.
    "scripts/lib/vite-aliases.mjs": ["exports"],
    // run-resume-codec is the canonical resume boundary (shops/interrupted-flow included).
    "src/features/alchemy/shared/stores/run-resume-codec.ts": ["exports"],
    // Test-only / external seams: profile slice and talent catalog are external contracts.
    "src/features/alchemy/shared/stores/profile-store.ts": ["exports"],
    "src/lib/game-data/talents/talent-pool-definitions.ts": ["exports"],
    "src/features/alchemy/shared/stores/persistence-codec.ts": ["types"],
    "src/features/alchemy/shared/stores/run-session-read-port.ts": ["exports", "files"],
    "src/features/alchemy/shared/stores/draft-helpers.ts": ["exports"],
    "src/features/alchemy/shared/stores/write-port-run.ts": ["exports", "duplicates"],
    "src/lib/content-systems/types.ts": ["exports", "types"],
    // Testable save-load seams: evaluated via storage-io tests; platform dedup is public API.
    "src/features/alchemy/shared/storage/io.ts": ["exports", "types"],
    "src/lib/platform-save-backend.ts": ["exports", "types"],
    "src/lib/validation/migration/content-steps.ts": ["exports"],
  },
  ignore: ["tests/environment.d.ts", "tests/scripts/global.d.ts", "tests/electron-environment.d.ts"],
  ignoreDependencies: [
    // Loaded via node_modules path string in scripts/dist-desktop.mjs; knip cannot trace it.
    "electron-builder",
    // Invoked via npx in scripts/lib/release-runner.mjs; knip cannot trace it.
    "commit-and-tag-version",
    // Bundled in @stryker-mutator/core; knip infers it from testRunner: "command".
    "@stryker-mutator/command-runner",
  ],
};
