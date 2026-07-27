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
 * `ignoreDependencies` covers packages knip cannot see through Vite/Electron
 * packaging (react*, zustand, Switch, electron). Do not "fix" by moving them
 * between dependency sections without verifying the runtime graph.
 *
 * `npm run deadcode` — CI / pre-push gate (default knip).
 * `npm run deadcode:strict` — nightly; includes entry exports, suppresses config hints.
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
    "tests/playwright-tags.ts": ["exports"],
    // Domain store exports store views + actions used via facade / tests helpers.
    "src/features/alchemy/shared/stores/run-domain-store.ts": ["exports", "duplicates"],
    "src/features/alchemy/shared/stores/run-transitions.ts": ["exports"],
    // Compatibility barrel for active-run persistence types + serializers.
    "src/lib/active-run-session/index.ts": ["exports", "types"],
    "src/lib/gear/types.ts": ["exports", "types"],
    "scripts/lib/git-release.mjs": ["exports"],
    "scripts/lib/patch-notes-core.mjs": ["exports"],
    // Compatibility re-export shim for tests still importing the run-loop path.
    "src/features/alchemy/run-loop/navigation/destination-flow.ts": ["exports"],
    "src/lib/game-constants.ts": ["exports"],
    "src/lib/routing/destinations.ts": ["exports"],
    "src/lib/routing/index.ts": ["exports"],
    "src/features/alchemy/meta/screens/armory/parts/grid-styles.ts": ["exports"],
    "src/lib/game-data/effects/registry.ts": ["exports"],
    "src/lib/gear/grid-packing.ts": ["exports"],
    "src/lib/gear/inventory-layout.ts": ["exports"],
    "src/lib/routing/run-screen-router.ts": ["exports"],
    "src/lib/utils.ts": ["exports", "types"],
    "src/app/screen-routes/index.tsx": ["types"],
    "src/features/alchemy/meta/screens/armory/armory-panels.tsx": ["types"],
    "src/features/alchemy/meta/screens/armory/armory-targeting-state.ts": ["types"],
    "src/lib/validation/migration/tombstoned-content-ids.ts": ["exports", "types"],
    // Generated asset catalog: re-exported via assets.ts (`export *`). Do not hand-edit.
    "src/lib/game-data/assets.generated.ts": ["exports"],
  },
  ignore: [
    "tests/environment.d.ts",
    "tests/scripts/global.d.ts",
    "tests/electron-environment.d.ts",
    // Dev-mode screen retained for error-log routing experiments; not mounted in normal builds.
    "src/features/alchemy/meta/screens/error-log-viewer.tsx",
  ],
  ignoreDependencies: [
    "tailwindcss-animate",
    // LIVE production deps: knip misses them because UI/store graphs hang off
    // non-entry modules that Vite bundles. Removing would break Switch + Zustand stores.
    "@radix-ui/react-switch",
    "zustand",
    // Kept in packaging norms (Vite bundles react*; Electron is desktop toolchain).
    "react",
    "react-dom",
    "electron",
  ],
};
