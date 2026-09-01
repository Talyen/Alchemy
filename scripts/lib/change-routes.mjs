import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COMMANDS, E2E_ESCALATIONS, E2E_NAMES, testFilesUnder } from "./test-commands.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Re-export for callers that import from change-routes (backward compat)
export { COMMANDS, E2E_ESCALATIONS, E2E_NAMES };

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
    id: "settings",
    patterns: [
      "src/lib/settings-values.ts",
      "src/features/alchemy/shared/stores/settings-store.ts",
      "src/features/alchemy/shared/config/options.ts",
      "src/features/alchemy/shared/ui/settings-controls.tsx",
      "src/features/alchemy/meta/screens/options-*.tsx",
      "src/app/screen-routes/options-screen-route.tsx",
      "src/app/use-app-effects.ts",
    ],
    commands: ["unit-settings", "e2e-prepush"],
    docs: [doc("docs/ARCHITECTURE.md", "Settings and meta profile", "settings ownership")],
    fixture: "src/features/alchemy/shared/stores/settings-store.ts",
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
    docs: [doc("docs/REFERENCE.md", "Content systems", "content systems")],
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
    patterns: ["src/lib/balance/**", "tests/balance/**"],
    commands: ["unit-balance", "report-balance"],
    docs: [doc("docs/REFERENCE.md", "Balance simulation", "balance harness interpretation")],
    fixture: "src/lib/balance/findings.ts",
  },
  {
    id: "performance",
    patterns: [
      "performance/**",
      "playwright.performance.config.ts",
      "scripts/run-performance.mjs",
      "src/lib/performance/**",
      "tests/performance/**",
      "tests/lib/performance/**",
      "docs/PERFORMANCE.md",
      "docs/Audits/PerformanceAudit.md",
    ],
    commands: ["unit-performance", "typecheck"],
    docs: [
      doc("docs/PERFORMANCE.md", "Performance profiling", "performance harness and profiling guide"),
      doc("docs/Audits/PerformanceAudit.md", "Performance Audit", "performance audit playbook"),
    ],
    fixture: "performance/metrics.ts",
  },
  {
    id: "desktop",
    patterns: [
      "desktop/**",
      "scripts/dist-desktop.mjs",
      "scripts/verify-desktop-package.mjs",
      "scripts/lib/desktop-artifact.mjs",
      "tests/desktop-*.test.ts",
      "src/lib/desktop-api.ts",
      "src/lib/platform.ts",
      "src/lib/settings-values.ts",
    ],
    commands: ["unit-desktop"],
    docs: [doc("docs/RELEASE.md", "Commands", "desktop packaging and verification")],
    fixture: "desktop/package-layout.cjs",
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
    patterns: [
      "src/lib/audio*.ts",
      "src/lib/sound-registry.ts",
      "src/lib/settings-values.ts",
      "src/features/alchemy/shared/stores/settings-store.ts",
      "src/app/use-app-effects.ts",
      "public/sounds/**",
    ],
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
    exclude: ["tests/scripts/**", "tests/architecture/**", "tests/balance/**", "tests/performance/**"],
    commands: ["unit-changed"],
    docs: [],
    fixture: "tests/lib/utils.test.ts",
  },
  {
    id: "e2e-helper",
    patterns: [
      "tests/e2e/**",
      "tests/fixtures/e2e.ts",
      "tests/pages/**",
      "tests/helpers.ts",
      "tests/playwright-shared.ts",
      "playwright*.config.ts",
    ],
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
      "eslint/**",
      "stryker.config.mjs",
      "dependency-cruiser.config.mjs",
      "knip.config.js",
      "vite.config.ts",
    ],
    exclude: [
      "scripts/run-performance.mjs",
      "scripts/assets/**",
      "scripts/prepare-assets.mjs",
      "scripts/check-prepared-assets.mjs",
      "scripts/optimize-assets.mjs",
      "scripts/optimize-music.mjs",
      "scripts/optimize-sounds.mjs",
      "scripts/sync-assets.mjs",
      "scripts/sync-gear-art.mjs",
      "scripts/sync-art-barrels.mjs",
      "scripts/sync-generated.mjs",
      "scripts/lib/asset-manifest-cache.mjs",
      "scripts/lib/sync-generated-helpers.mjs",
      "scripts/lib/asset-constants.mjs",
      "scripts/lib/audio-optimizer.mjs",
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
      "scripts/check-prepared-assets.mjs",
      "scripts/optimize-assets.mjs",
      "scripts/optimize-music.mjs",
      "scripts/optimize-sounds.mjs",
      "scripts/sync-assets.mjs",
      "scripts/sync-gear-art.mjs",
      "scripts/sync-art-barrels.mjs",
      "scripts/sync-generated.mjs",
      "scripts/lib/asset-manifest-cache.mjs",
      "scripts/lib/sync-generated-helpers.mjs",
      "scripts/lib/asset-constants.mjs",
      "scripts/lib/audio-optimizer.mjs",
      "src/assets/optimized/**",
      "public/sounds/**",
      "public/Music/**",
      "src/lib/game-data/assets.generated.ts",
      "src/lib/game-data/gear-art.ts",
    ],
    commands: ["unit-tooling", "typecheck", "assets-check"],
    docs: [doc("docs/WORKFLOWS-ASSETS.md", null, "authored asset and generated-output workflow")],
    fixture: "scripts/assets/core-assets.mjs",
  },
  {
    id: "ci-routing",
    patterns: [
      ".github/workflows/**",
      "scripts/check-ci-routing.mjs",
      "scripts/check-test-owners.mjs",
      "scripts/ci-verify-plan.mjs",
      "scripts/lib/route-hints.mjs",
    ],
    commands: ["ci-routing"],
    docs: [],
    fixture: ".github/workflows/ci.yml",
  },
  {
    id: "documentation",
    patterns: [
      "AGENTS.md",
      "CONTRIBUTING.md",
      "LICENSE.md",
      "PRIVACY.md",
      "README.md",
      "THIRD_PARTY_NOTICES.md",
      "docs/**",
      "tests/e2e/README.md",
      ".agents/skills/**",
      ".agents/knowledge/**",
      ".agents/evals/**",
      ".cursor/**",
      "scripts/archive-plans.mjs",
      "scripts/check-documentation-contract.mjs",
      "scripts/check-docs.mjs",
      "scripts/check-plans.mjs",
      "scripts/new-plan.mjs",
    ],
    commands: ["docs-check"],
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
  const directUnitTestRoute = ROUTES.find((route) => route.id === "unit-test");
  const changedUnitTests = paths
    .map(normalizeChangedPath)
    .filter(
      (filePath) =>
        /^tests\/.*\.test\.tsx?$/u.test(filePath) &&
        directUnitTestRoute !== undefined &&
        routeMatchesPath(directUnitTestRoute, filePath),
    );
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
