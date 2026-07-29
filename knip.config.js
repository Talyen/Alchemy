/**
 * Knip dead-code policy
 * ---------------------
 * Barrels are **thin convenience entries**, not public API dumps:
 * only re-export what callers import from the barrel path itself.
 * Deep imports (`shared/run-flow/destination-flow`) are preferred inside features.
 *
 * Prefer removing unused exports over growing `ignoreIssues`.
 * Entries listed under `ignoreIssues` must be intentional seams, generated
 * catalogs, or compatibility re-exports — each with a short reason.
 *
 * `npm run deadcode` — CI / pre-push gate (default knip, config hints suppressed).
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
    "src/lib/battle/index.ts",
    "src/lib/validation/index.ts",
    "src/features/alchemy/shared/stores/run-session-facade.ts",
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
    // Compatibility re-export shim for tests still importing the run-loop path.
    "src/features/alchemy/run-loop/navigation/destination-flow.ts": ["exports"],
    "src/lib/routing/destinations.ts": ["exports"],
    "src/lib/routing/index.ts": ["exports"],
    "src/features/alchemy/meta/screens/armory/parts/grid-styles.ts": ["exports"],
    "src/lib/game-data/effects/registry.ts": ["exports"],
    "src/lib/gear/grid-packing.ts": ["exports"],
    "src/lib/routing/run-screen-router.ts": ["exports"],
    "src/lib/utils.ts": ["exports", "types"],
    "src/app/screen-routes/index.tsx": ["types"],
    "src/lib/validation/migration/tombstoned-content-ids.ts": ["exports", "types"],
  },
  ignore: [
    "tests/environment.d.ts",
    "tests/scripts/global.d.ts",
    "tests/electron-environment.d.ts",
    // Dev-mode screen retained for error-log routing experiments; not mounted in normal builds.
    "src/features/alchemy/meta/screens/error-log-viewer.tsx",
  ],
  ignoreDependencies: ["tailwindcss-animate"],
};
