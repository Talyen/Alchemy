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
 * Default mode traces dependencies through the Vite/Electron graph correctly,
 * so dependency checking lives here.
 * `npm run deadcode:strict` — nightly; entry exports + config hints. Dependency
 * classes are excluded: strict (production-only) analysis cannot trace this
 * graph and reports ~10 false positives. Config hints surface stale
 * `ignoreDependencies`; `ignoreIssues` staleness is not covered by hints —
 * probe occasionally by running knip with the block emptied.
 */
export default {
  entry: [
    "src/lib/game-data/index.ts",
    "src/lib/game-constants/index.ts",
    "playwright.config.ts",
    "playwright.electron.config.ts",
    "playwright.performance.config.ts",
    "src/lib/battle/index.ts",
    "src/lib/validation/index.ts",
    "src/features/alchemy/shared/run-flow/index.ts",
    "scripts/*.mjs",
    "desktop/*.cjs",
  ],
  project: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs", "desktop/**/*.cjs", "tests/**/*.{ts,tsx}"],
  ignoreBinaries: ["start"],
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
    // Registry is internal but exported for envelope-key derivation tests; not yet imported as entry.
    "src/features/alchemy/shared/storage/codec-registry.ts": ["exports"],
    // Orchestration port is consumed via type-level architecture contract; knip cannot trace test-d import when file is ignored.
    "src/features/alchemy/shared/stores/run-session-react-ports.ts": ["exports"],
    // Semantic alias: corruption weight mirrors default for now, intentional duplicate.
    "src/lib/game-constants/run-rewards.ts": ["duplicates"],
    // Compat barrel: talentPool is single source, per-keyword arrays are filtered views for legacy imports.
    "src/lib/game-data/talents/pool/index.ts": ["exports"],
    // Backward-compat re-exports for verify:changed consumers; canonical source is scripts/lib/test-commands.mjs.
    "scripts/lib/change-routes.mjs": ["exports"],
    // Shared Vite alias / SSR list — consumed by vite.config.ts and vitest.config.ts sync guard.
    "scripts/lib/vite-aliases.mjs": ["exports"],
  },
  ignore: [
    "tests/environment.d.ts",
    "tests/scripts/global.d.ts",
    "tests/electron-environment.d.ts",
    "tests/types/run-architecture-contracts.test-d.ts",
  ],
  ignoreDependencies: [
    // Loaded via node_modules path string in scripts/dist-desktop.mjs; knip cannot trace it.
    "electron-builder",
    // Invoked via npx in scripts/lib/release-runner.mjs; knip cannot trace it.
    "commit-and-tag-version",
    // Bundled in @stryker-mutator/core; knip infers it from testRunner: "command".
    "@stryker-mutator/command-runner",
  ],
};
