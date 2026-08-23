import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TEST_SUITES, testFilesUnder } from "./test-suites.mjs";

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const E2E_ESCALATIONS = Object.freeze({
  save: "e2e-save",
  "shop-screen": "e2e-shop",
  audio: "e2e-audio",
  gear: "e2e-gear",
  mystery: "e2e-mystery",
});

export const E2E_NAMES = new Set(["save", "shop", "audio", "gear", "mystery"]);

const COMMANDS = Object.freeze({
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
    reason: "documentation and agent-policy changes must preserve the plan contract",
    command: NPM,
    args: ["run", "docs:check"],
  },
  "docs-contract": {
    label: "documentation link and script contract",
    reason: "documentation changes must keep local links, anchors, scripts, and required paths valid",
    command: NPM,
    args: ["test", "--", "tests/scripts/documentation-contract.test.ts"],
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

const doc = (path, heading, reason) => ({ path, heading, reason });

export const ROUTES = Object.freeze([
  {
    id: "active-run",
    patterns: [
      "src/features/alchemy/shared/stores/**",
      "src/app/use-alchemy-bootstrap.ts",
      "src/app/use-app-navigation.ts",
      "src/features/alchemy/shell/use-alchemy-run-controller.ts",
      "src/features/alchemy/shared/ui/fade-slot.tsx",
      "src/features/alchemy/shared/ui/use-sequential-fade-swap.ts",
    ],
    exclude: [
      "src/features/alchemy/shared/stores/gear-*.ts",
      "src/features/alchemy/shared/stores/settings-store.ts",
      "src/features/alchemy/shared/stores/ui-store.ts",
    ],
    commands: ["unit-active", "boundary", "e2e-prepush"],
    docs: [doc("docs/ARCHITECTURE.md", "Session capability ports", "run-session access and ownership")],
    fixture: "src/features/alchemy/shared/stores/run-session-read-port.ts",
  },
  {
    id: "save",
    patterns: [
      "src/features/alchemy/shared/storage/**",
      "src/lib/validation/save-schemas/**",
      "src/lib/active-run-session/**",
      "src/features/alchemy/app/autosave-*.ts",
    ],
    commands: ["unit-save", "e2e-prepush"],
    docs: [
      doc("docs/WORKFLOWS.md", "Change persisted save data", "save-change checklist"),
      doc("src/features/alchemy/shared/storage/MIGRATIONS.md", "Public save contract", "save compatibility contract"),
    ],
    fixture: "src/features/alchemy/shared/storage/io.ts",
  },
  {
    id: "battle",
    patterns: [
      "src/lib/battle/**",
      "src/lib/game-data/**",
      "src/lib/trinkets.ts",
      "src/features/alchemy/run-loop/battle/**",
      "src/app/screen-routes/use-battle-playback.ts",
    ],
    exclude: ["src/lib/game-data/*.generated.ts"],
    commands: ["unit-battle"],
    docs: [doc("docs/REFERENCE.md", "Battle Implementation Rules", "battle-specific engine rules")],
    fixture: "src/lib/battle/damage.ts",
  },
  {
    id: "content-systems",
    patterns: ["src/lib/content-systems/**"],
    commands: ["unit-content"],
    docs: [doc("docs/REFERENCE.md", "Domain Glossary", "content systems")],
    fixture: "src/lib/content-systems/encounter-traits.ts",
  },
  {
    id: "homestead",
    patterns: ["src/lib/homestead/**"],
    commands: ["unit-homestead"],
    docs: [doc("docs/WORKFLOWS.md", "Add a homestead upgrade", "homestead progression data")],
    fixture: "src/lib/homestead/tiers.ts",
  },
  {
    id: "generated",
    patterns: ["**/*.generated.ts", "**/*.generated.tsx", "**/*.generated.js"],
    commands: ["unit-tooling"],
    docs: [],
    fixture: "src/lib/game-data/assets.generated.ts",
  },
  {
    id: "balance",
    patterns: ["src/lib/balance/**"],
    commands: ["unit-balance"],
    docs: [doc("docs/REFERENCE.md", "Balance simulation", "balance harness interpretation")],
    fixture: "src/lib/balance/findings.ts",
  },
  {
    id: "shop",
    patterns: [
      "src/features/alchemy/run-loop/shop/**",
      "src/features/alchemy/run-loop/screens/*shop*",
      "src/features/alchemy/shell/use-shop-controller.ts",
      "src/lib/alchemist/**",
    ],
    commands: ["unit-shop"],
    docs: [doc("docs/WORKFLOWS.md", "Change a shop", "shop command ownership")],
    fixture: "src/features/alchemy/run-loop/shop/create-shop-actions.ts",
  },
  {
    id: "shop-screen",
    patterns: ["src/features/alchemy/run-loop/screens/*shop*"],
    commands: ["typecheck"],
    docs: [doc("docs/WORKFLOWS.md", "Change a shop", "shop screen workflow")],
    fixture: "src/features/alchemy/run-loop/screens/alchemist-shop-screen.tsx",
  },
  {
    id: "audio",
    patterns: ["src/lib/audio*.ts", "src/lib/sound-registry.ts", "public/sounds/**"],
    commands: ["unit-audio"],
    docs: [],
    fixture: "src/lib/audio-sfx.ts",
  },
  {
    id: "routing",
    patterns: [
      "src/lib/routing/**",
      "src/app/screen-routes/**",
      "src/app/use-app-navigation.ts",
      "src/features/alchemy/shell/use-screen-transitions.ts",
    ],
    commands: ["unit-routing", "boundary", "e2e-prepush"],
    docs: [doc("docs/ARCHITECTURE.md", "Controller entry points", "screen/controller bindings")],
    fixture: "src/app/screen-routes/run-loop-routes.tsx",
  },
  {
    id: "gear",
    patterns: [
      "src/lib/gear/**",
      "src/features/alchemy/meta/screens/armory/**",
      "src/features/alchemy/meta/screens/armory-screen.tsx",
      "src/features/alchemy/shared/stores/gear-*.ts",
    ],
    commands: ["unit-gear"],
    docs: [
      doc("docs/WORKFLOWS.md", "Add permanent Gear", "gear authoring workflow"),
      doc("docs/ARMORY.md", "Layout", "Armory feature map"),
    ],
    fixture: "src/features/alchemy/meta/screens/armory-screen.tsx",
  },
  {
    id: "mystery",
    patterns: [
      "src/lib/mystery/**",
      "src/lib/active-run-session/mystery-visit-persistence.ts",
      "src/features/alchemy/run-loop/navigation/*mystery*",
      "src/features/alchemy/run-loop/screens/mystery/**",
      "src/app/screen-routes/mystery-screen-route.tsx",
      "src/features/alchemy/shell/use-mystery-event-navigation.ts",
    ],
    commands: ["unit-mystery"],
    docs: [doc("docs/WORKFLOWS.md", "Adding a new mystery effect kind", "mystery effect workflow")],
    fixture: "src/lib/mystery/pool.ts",
  },
  {
    id: "integration",
    patterns: ["src/features/alchemy/run-loop/navigation/reward-flow*.ts", "src/features/alchemy/shell/**"],
    commands: ["unit-integration"],
    docs: [doc("docs/ARCHITECTURE.md", "Session capability ports", "cross-feature run-session ownership")],
    fixture: "src/features/alchemy/shell/use-alchemy-run-controller.ts",
  },
  {
    id: "unit-test",
    patterns: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "tests/*.test.ts", "tests/*.test.tsx"],
    exclude: ["tests/scripts/**", "tests/architecture/**"],
    commands: ["unit-changed"],
    docs: [],
    fixture: "tests/scripts/verify-changed.test.ts",
  },
  {
    id: "e2e-helper",
    patterns: ["tests/e2e/**", "tests/fixtures/e2e.ts", "tests/pages/**", "tests/helpers.ts", "playwright*.config.ts"],
    exclude: ["tests/e2e/README.md"],
    commands: ["e2e-prepush"],
    docs: [doc("tests/e2e/README.md", "E2E helpers", "E2E fixture and page-object contract")],
    fixture: "tests/fixtures/e2e.ts",
  },
  {
    id: "root-specs",
    patterns: ["tests/*.spec.ts"],
    exclude: ["tests/electron-smoke.spec.ts", "tests/electron-security.spec.ts"],
    commands: ["unit-changed", "e2e-prepush"],
    docs: [doc("CONTRIBUTING.md", "E2E policy", "changed-path and CI tier policy")],
    fixture: "tests/helpers.ts",
  },
  {
    id: "tooling",
    patterns: [
      "scripts/**",
      "tests/scripts/**",
      "tests/architecture/**",
      "package.json",
      "tsconfig*.json",
      "eslint.config.js",
      "dependency-cruiser.config.mjs",
      "knip.config.js",
      "vite.config.ts",
    ],
    exclude: [
      "scripts/assets/**",
      "scripts/prepare-assets.mjs",
      "scripts/optimize-assets.mjs",
      "scripts/optimize-music.mjs",
      "scripts/optimize-sounds.mjs",
    ],
    commands: ["unit-tooling", "typecheck"],
    docs: [],
    fixture: "scripts/measure-agent-context.mjs",
  },
  {
    id: "assets",
    patterns: [
      "Raw Assets/**",
      "scripts/assets/**",
      "scripts/prepare-assets.mjs",
      "scripts/optimize-assets.mjs",
      "scripts/optimize-music.mjs",
      "scripts/optimize-sounds.mjs",
      "src/assets/optimized/**",
    ],
    commands: ["unit-tooling"],
    docs: [doc("docs/WORKFLOWS-ASSETS.md", null, "authored asset and generated-output workflow")],
    fixture: "scripts/assets/core-assets.mjs",
  },
  {
    id: "ci-routing",
    patterns: [".github/workflows/**", "scripts/check-ci-routing.mjs"],
    commands: ["ci-routing"],
    docs: [],
    fixture: ".github/workflows/ci.yml",
  },
  {
    id: "documentation",
    patterns: [
      "AGENTS.md",
      "CONTRIBUTING.md",
      "README.md",
      "docs/**",
      "tests/e2e/README.md",
      ".agents/skills/**",
      "scripts/check-docs.mjs",
      "scripts/new-plan.mjs",
    ],
    commands: ["docs-check", "docs-contract"],
    docs: [doc("docs/Plans/README.md", null, "active plan contract")],
    fixture: "docs/WORKFLOWS.md",
  },
  {
    id: "ui-flow",
    patterns: ["src/features/alchemy/**/screens/**", "src/features/alchemy/**/controllers/**"],
    exclude: [
      "src/features/alchemy/meta/screens/armory/**",
      "src/features/alchemy/meta/screens/armory-screen.tsx",
      "src/features/alchemy/run-loop/screens/*shop*",
      "src/features/alchemy/run-loop/screens/mystery/**",
    ],
    commands: ["e2e-prepush"],
    docs: [doc("docs/WORKFLOWS.md", "Adding a new screen", "screen/controller workflow")],
    fixture: "src/features/alchemy/run-setup/screens/difficulty-select-screen.tsx",
  },
]);

function globToRegExp(glob) {
  let source = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
  }
  return new RegExp(`${source}$`, "u");
}

const patternCache = new Map();
function matchesPattern(filePath, pattern) {
  let expression = patternCache.get(pattern);
  if (!expression) {
    expression = globToRegExp(pattern);
    patternCache.set(pattern, expression);
  }
  return expression.test(filePath);
}

function routeMatchesPath(route, filePath) {
  return (
    route.patterns.some((pattern) => matchesPattern(filePath, pattern)) &&
    !(route.exclude ?? []).some((pattern) => matchesPattern(filePath, pattern))
  );
}

function headingExists(source, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^#{1,6}\\s+${escaped}\\s*#*\\s*$`, "mu").test(source);
}

/**
 * Validate the catalog's named files before a route can silently narrow.
 * Glob patterns remain intentionally open-ended; only concrete command args,
 * fixtures, and owner-document headings are checked here.
 *
 * @param {{ rootDir?: string }} [options]
 * @returns {string[]}
 */
export function validateRouteCatalog({ rootDir = process.cwd() } = {}) {
  const errors = [];
  const concretePathArgs = new Set();

  for (const command of Object.values(COMMANDS)) {
    for (const arg of command.args) {
      if (!/^(?:tests|src|scripts|docs)\//u.test(arg) || /[*?]/u.test(arg)) continue;
      concretePathArgs.add(arg);
    }
  }

  for (const relativePath of concretePathArgs) {
    if (!existsSync(path.join(rootDir, relativePath))) {
      errors.push(`command path does not exist: ${relativePath}`);
    }
  }

  for (const route of ROUTES) {
    if (route.fixture && !existsSync(path.join(rootDir, route.fixture))) {
      errors.push(`${route.id} fixture does not exist: ${route.fixture}`);
    }

    for (const owner of route.docs ?? []) {
      const docPath = path.join(rootDir, owner.path);
      if (!existsSync(docPath)) {
        errors.push(`${route.id} owner document does not exist: ${owner.path}`);
        continue;
      }
      if (owner.heading && !headingExists(readFileSync(docPath, "utf8"), owner.heading)) {
        errors.push(`${route.id} owner heading does not exist: ${owner.path}#${owner.heading}`);
      }
    }
  }

  return errors;
}

function normalizeChangedPath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//u, "");
}

const UNKNOWN_ROUTE = Object.freeze({
  id: "unknown",
  patterns: ["**"],
  commands: ["typecheck"],
  docs: [],
  unknown: true,
});

export function resolveRoutes(paths) {
  const normalized = paths.map(normalizeChangedPath);
  const matched = ROUTES.filter((route) => normalized.some((filePath) => routeMatchesPath(route, filePath)));
  const hasUnknownPath =
    normalized.length === 0 ||
    normalized.some((filePath) => !ROUTES.some((route) => routeMatchesPath(route, filePath)));
  return hasUnknownPath ? [...matched, UNKNOWN_ROUTE] : matched;
}

export function resolveRoutePlan(paths, options = {}) {
  const routes = resolveRoutes(paths);
  const commandKeys = new Set(routes.flatMap((route) => route.commands));
  const changedUnitTests = paths
    .map(normalizeChangedPath)
    .filter((filePath) => /^tests\/.*\.test\.tsx?$/u.test(filePath));
  // A changed test already executed by a matched route's focused unit command
  // must not run twice (once via that command, once via unit-changed), so the
  // unit-changed file list only carries tests no matched route covers.
  const routeCoveredTests = new Set(
    [...commandKeys]
      .filter((key) => key.startsWith("unit-") && key !== "unit-changed")
      .flatMap((key) => COMMANDS[key].args.slice(2))
      .flatMap((entry) => testFilesUnder(ROOT_DIR, entry)),
  );
  const uncoveredUnitTests = changedUnitTests.filter((filePath) => !routeCoveredTests.has(filePath));
  if (commandKeys.has("unit-changed") && uncoveredUnitTests.length === 0) {
    commandKeys.delete("unit-changed");
  }
  const e2eSelection = options.e2e ?? (options.includeE2E ? true : false);
  if (e2eSelection) {
    if (typeof e2eSelection === "string") {
      const routeId = e2eSelection === "shop" ? "shop-screen" : e2eSelection;
      const commandKey = E2E_ESCALATIONS[routeId];
      if (commandKey) commandKeys.add(commandKey);
    } else {
      for (const route of routes) {
        const commandKey = E2E_ESCALATIONS[route.id];
        if (commandKey) commandKeys.add(commandKey);
      }
    }
  }
  if (options.full) commandKeys.add("full");
  return {
    paths,
    routes,
    commands: [...commandKeys].map((key) => {
      const command = COMMANDS[key];
      return key === "unit-changed"
        ? { key, ...command, args: [...command.args, ...uncoveredUnitTests] }
        : { key, ...command };
    }),
  };
}
