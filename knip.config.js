export default {
  entry: [
    "src/App.tsx",
    "src/lib/game-data/index.ts",
    "src/lib/battle/index.ts",
    "src/lib/validation/index.ts",
    "src/features/alchemy/shared/stores/run-session-facade.ts",
    "src/features/alchemy/shell/use-alchemy-run-controller.ts",
    "src/features/alchemy/shell/use-run-navigation.ts",
    "src/features/alchemy/shell/use-battle-controller.ts",
    "src/features/alchemy/shell/use-shop-controller.ts",
    "src/features/alchemy/shell/use-labyrinth-controller.ts",
    "scripts/*.mjs",
    "desktop/*.cjs",
  ],
  project: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs", "desktop/**/*.cjs", "tests/**/*.{ts,tsx}"],
  ignoreBinaries: ["start"],
  // These are intentional public seams, compatibility barrels, or dynamically
  // referenced helpers. Prefer removing entries when a caller becomes explicit.
  ignoreIssues: {
    "tests/playwright-tags.ts": ["exports"],
    "src/features/alchemy/shared/stores/run-domain-store.ts": ["exports", "duplicates"],
    "src/features/alchemy/shared/stores/run-transitions.ts": ["exports"],
    "src/lib/active-run-session/index.ts": ["exports", "types"],
    "src/lib/gear/types.ts": ["exports", "types"],
    "scripts/lib/git-release.mjs": ["exports"],
    "scripts/lib/patch-notes-core.mjs": ["exports"],
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
    // Generated asset catalog: re-exported via assets.ts (`export *`) for card/compendium
    // `import * as assetRefs` + a few named imports. Do not hand-edit; regenerating sync owns it.
    // Removing the barrel would break 30+ named import sites — leave export * and silence knip noise.
    "src/lib/game-data/assets.generated.ts": ["exports"],
  },
  ignore: [
    "tests/environment.d.ts",
    "tests/scripts/global.d.ts",
    "tests/electron-environment.d.ts",
    // Dev-mode screen retained for error-log routing experiments; it is not mounted in normal builds.
    "src/features/alchemy/meta/screens/error-log-viewer.tsx",
  ],
  ignoreDependencies: [
    "tailwindcss-animate",
    // LIVE production deps: knip --strict misses them because UI/store graphs hang off
    // non-entry modules that Vite bundles. Removing would break Switch + all Zustand stores.
    "@radix-ui/react-switch",
    "zustand",
    // Kept in devDependencies by project packaging norms (Vite bundles react*; Electron is a
    // desktop toolchain dep, not an end-user npm install). Knip reports them as unlisted from
    // src/main.tsx + desktop/main.cjs — allowlist only; do not move into dependencies.
    "react",
    "react-dom",
    "electron",
  ],
};
