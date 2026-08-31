import { globSync } from "node:fs";

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

export const TEST_SUITES = Object.freeze({
  save: Object.freeze([
    "tests/features/alchemy/shared/storage",
    "tests/features/alchemy/app/autosave-hook.test.ts",
    "tests/features/alchemy/app/autosave-active-run.test.ts",
  ]),
  tooling: Object.freeze(["tests/scripts", "tests/architecture"]),
  shipUnit: Object.freeze([
    "tests/features/alchemy/shared/storage",
    "tests/features/alchemy/app/autosave-hook.test.ts",
    "tests/features/alchemy/app/autosave-active-run.test.ts",
    "tests/lib/validation",
    "tests/lib/active-run-session",
    "tests/scripts",
    "tests/architecture",
  ]),
});

export function testFilesUnder(rootDir, rootPath) {
  const pattern =
    rootPath.endsWith(".test.ts") || rootPath.endsWith(".test.tsx") ? rootPath : `${rootPath}/**/*.test.{ts,tsx}`;
  return globSync(pattern, { cwd: rootDir });
}

export function validateTestSuitePaths(rootDir, suites = TEST_SUITES.shipUnit) {
  return suites.filter((entry) => testFilesUnder(rootDir, entry).length === 0);
}

export const E2E_ESCALATIONS = Object.freeze({
  save: "e2e-save",
  shop: "e2e-shop",
  "shop-screen": "e2e-shop",
  audio: "e2e-audio",
  gear: "e2e-gear",
  mystery: "e2e-mystery",
});

export const E2E_NAMES = new Set(Object.keys(E2E_ESCALATIONS).filter((k) => k !== "shop-screen"));

export const COMMANDS = Object.freeze({
  "unit-settings": {
    label: "settings and Options unit tests",
    reason: "settings values, persistence, Options bindings, audio effects, and display contracts move together",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/lib/settings-values.test.ts",
      "tests/lib/validation/save-schemas.test.ts",
      "tests/features/alchemy/shared/stores/profile-settings-stores.test.ts",
      "tests/features/alchemy/meta/screens/options-screen.test.tsx",
      "tests/app/options-screen-route.test.tsx",
      "tests/app/use-app-audio-effects.test.ts",
      "tests/app/use-initial-load-ready.test.ts",
    ],
  },
  "unit-active": {
    label: "active-run unit tests",
    reason: "run-session changes share aggregate, resume, shell, and fade contracts",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/app/use-alchemy-bootstrap.test.ts",
      "tests/app/use-rendered-screen-transition.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-progress.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-resume.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-session.test.ts",
      "tests/features/alchemy/shared/stores/run-session-model.test.ts",
      "tests/features/alchemy/shared/stores/run-session-port-exports.test.ts",
      "tests/features/alchemy/shared/stores/run-session-read-port.test.ts",
      "tests/features/alchemy/shared/stores/run-session-transaction.test.ts",
      "tests/features/alchemy/shared/stores/gold-purse.test.ts",
      "tests/features/alchemy/shared/stores/run-screen-data.test.tsx",
      "tests/features/alchemy/shared/stores/run-park-restore.test.ts",
      "tests/features/alchemy/shared/stores/run-meta-rebind.test.ts",
      "tests/features/alchemy/shared/stores/parked-runs.test.ts",
      "tests/features/alchemy/shared/stores/reset.test.ts",
      "tests/features/alchemy/shared/stores/select-autosave-allowed.test.ts",
      "tests/features/alchemy/shared/ui/fade-slot.test.tsx",
      "tests/features/alchemy/shared/ui/use-sequential-fade-swap.test.ts",
      "tests/features/alchemy/shell/",
    ],
  },
  "unit-save": {
    label: "save/persistence unit tests",
    reason: "save changes must preserve schema, storage, autosave, and hydration behavior",
    command: NPM,
    args: ["test", "--", ...TEST_SUITES.save],
  },
  "unit-battle": {
    label: "battle/card unit tests",
    reason: "battle and card data share effect, playback, and description invariants",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/lib/battle",
      "tests/features/alchemy/run-loop/battle",
      "tests/app/use-battle-playback.test.ts",
      "tests/lib/game-data/descriptions-match-effects.test.ts",
      "tests/lib/game-data/talent-pool.test.ts",
      "tests/lib/game-data/talent-effect-invariants.test.ts",
    ],
  },
  "unit-balance": {
    label: "balance unit tests",
    reason: "balance helpers have a focused pure-logic suite",
    command: NPM,
    args: ["test", "--", "tests/lib/balance"],
  },
  "unit-desktop": {
    label: "desktop main-process and packaging unit tests",
    reason: "desktop bridge, security, crash reporting, and package layout share the Electron boundary",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/desktop-security.test.ts",
      "tests/desktop-sentry.test.ts",
      "tests/desktop-package-layout.test.ts",
    ],
  },
  "unit-shop": {
    label: "shop unit tests",
    reason: "shop commands and both shop screens share transaction behavior",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/features/alchemy/run-loop/shop",
      "tests/features/alchemy/run-loop/screens/alchemist-shop-screen.test.tsx",
      "tests/features/alchemy/run-loop/screens/merchant-shop-screen.test.tsx",
    ],
  },
  "unit-audio": {
    label: "audio unit tests",
    reason: "audio registry, cache, and playback changes share one contract",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/lib/audio-sfx.test.ts",
      "tests/lib/audio-sfx-playback.test.ts",
      "tests/lib/audio-preload.test.ts",
      "tests/lib/audio-host.test.ts",
      "tests/lib/audio-volume.test.ts",
      "tests/lib/audio-music.test.ts",
      "tests/app/use-app-audio-effects.test.ts",
      "tests/lib/sound-assets.test.ts",
    ],
  },
  "unit-routing": {
    label: "routing unit tests",
    reason: "screen route changes affect navigation, transitions, and battle playback",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/lib/routing",
      "tests/features/alchemy/shell/use-screen-transitions.test.ts",
      "tests/app/use-rendered-screen-transition.test.ts",
      "tests/app/use-battle-playback.test.ts",
    ],
  },
  "unit-gear": {
    label: "gear unit tests",
    reason: "Armory UI, gear state, affixes, crafting, and persistence are one feature contract",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/lib/gear",
      "tests/architecture/affix-catalog-guard.test.ts",
      "tests/architecture/gear-ranged-tags.test.ts",
      "tests/architecture/gear-affix-pool.test.ts",
      "tests/features/alchemy/shared/stores/gear-store.test.ts",
      "tests/features/alchemy/shared/stores/gear-crafting.test.ts",
      "tests/features/alchemy/meta/screens/armory",
      "tests/features/alchemy/meta/screens/armory-screen.test.tsx",
      "tests/features/alchemy/meta/screens/armory-screen-currency.test.tsx",
      "tests/features/alchemy/meta/screens/armory-screen-salvage.test.tsx",
      "tests/features/alchemy/meta/screens/armory-screen-tooltips.test.tsx",
      "tests/features/alchemy/shared/storage/gear-save.test.ts",
    ],
  },
  "unit-mystery": {
    label: "mystery-flow unit tests",
    reason: "mystery state, persistence, navigation, and screens form one flow",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/features/alchemy/run-loop/navigation/mystery-flow.test.ts",
      "tests/features/alchemy/shell/use-mystery-event-navigation.test.ts",
      "tests/features/alchemy/app/mystery-route.test.tsx",
      "tests/lib/mystery",
      "tests/lib/active-run-session/mystery-visit-persistence.test.ts",
      "tests/features/alchemy/shared/storage/active-run-data.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-resume.test.ts",
      "tests/features/alchemy/run-loop/screens/mystery",
      "tests/features/alchemy/run-loop/screens/mystery-event-intro.test.tsx",
      "tests/features/alchemy/run-loop/screens/mystery-reward-summary.test.tsx",
    ],
  },
  "unit-integration": {
    label: "integration-style unit tests",
    reason: "shell and reward-flow changes cross run-session feature seams",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/features/alchemy/shared/stores/run-domain-progress.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-resume.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-session.test.ts",
      "tests/features/alchemy/shared/storage",
      "tests/features/alchemy/run-loop/navigation/reward-flow-selection.test.ts",
      "tests/features/alchemy/run-loop/navigation/reward-flow.test.ts",
      "tests/features/alchemy/shell",
    ],
  },
  "unit-tooling": {
    label: "repository-tooling contract tests",
    reason: "scripts and root manifests are exercised by script and architecture guards",
    command: NPM,
    args: ["test", "--", ...TEST_SUITES.tooling],
  },
  "assets-check": {
    label: "prepared asset verification",
    reason: "asset sources and pipeline helpers must reproduce the committed outputs",
    command: NPM,
    args: ["run", "assets:check"],
  },
  "unit-changed": {
    label: "changed unit tests",
    reason: "changed Vitest files must execute even when their source owner is not part of the diff",
    command: NPM,
    args: ["test", "--"],
  },
  boundary: {
    label: "import-boundary lint",
    reason: "the touched path participates in an enforced dependency boundary",
    command: NPM,
    args: ["run", "lint:boundaries"],
  },
  "e2e-prepush": {
    label: "Playwright pre-push canary",
    reason: "the touched path can affect application boot or a player-visible flow",
    command: NPM,
    args: ["run", "test:e2e:prepush"],
  },
  "e2e-save": {
    label: "save Playwright flow",
    reason: "save changes require the persisted browser journey",
    command: "npx",
    args: ["playwright", "test", "tests/save-persistence.spec.ts", "--project", "chromium"],
  },
  "e2e-shop": {
    label: "shop Playwright flow",
    reason: "shop screen changes require the purchase/reward journey",
    command: "npx",
    args: ["playwright", "test", "tests/shop-and-rewards.spec.ts", "--project", "chromium"],
  },
  "e2e-audio": {
    label: "audio Playwright flow",
    reason: "browser audio behavior requires a real page context",
    command: "npx",
    args: ["playwright", "test", "tests/audio-sfx.spec.ts", "--project", "chromium"],
  },
  "unit-content": {
    label: "content-systems unit tests",
    reason: "labyrinth and wildwood content logic is one contract",
    command: NPM,
    args: ["test", "--", "tests/lib/content-systems"],
  },
  "unit-homestead": {
    label: "homestead unit tests",
    reason: "homestead progression data is one contract",
    command: NPM,
    args: ["test", "--", "tests/lib/homestead.test.ts", "tests/lib/homestead"],
  },
  "e2e-gear": {
    label: "gear Playwright flows",
    reason: "Armory changes require crafting and equip journeys",
    command: "npx",
    args: ["playwright", "test", "tests/armory.spec.ts", "--project", "chromium"],
  },
  "e2e-mystery": {
    label: "mystery Playwright flow",
    reason: "mystery changes require the destination journey",
    command: "npx",
    args: ["playwright", "test", "tests/destination-progression.spec.ts", "-g", "Mystery", "--project", "chromium"],
  },
  typecheck: {
    label: "TypeScript typecheck",
    reason: "the route requires a safe static fallback",
    command: NPM,
    args: ["run", "typecheck"],
  },
  "docs-check": {
    label: "documentation and plan checks",
    reason: "documentation and agent-policy changes must preserve documentation and plan contracts",
    command: NPM,
    args: ["run", "docs:check"],
  },
  "ci-routing": {
    label: "CI path-filter contract",
    reason: "workflow changes must preserve high-cost job routing",
    command: NPM,
    args: ["run", "ci:routing"],
  },
  full: {
    label: "full pre-push gate",
    reason: "the caller explicitly requested the full local handoff gate",
    command: NPM,
    args: ["run", "check:push"],
  },
});
