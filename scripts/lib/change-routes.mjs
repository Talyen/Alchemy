import { existsSync } from "node:fs";
import path from "node:path";

import { globToRegExp } from "./glob-pattern.mjs";
import { expandRepositoryPaths, toRepoRelative } from "./repository-paths.mjs";
import { COMMANDS } from "./test-commands.mjs";
import { readDocumentSection } from "./markdown-sections.mjs";

const ROOT_DIR = path.resolve(import.meta.dirname, "../..");

function doc(pathname, heading = null, reason = "owner documentation") {
  return { path: pathname, heading, reason };
}

function route(id, patterns, commands, docs, fixture, exclude = []) {
  return Object.freeze({ id, patterns, commands, docs, fixture, exclude });
}

// Shared build inputs that force both web and desktop renderer rebuilds.
// Owned here so scripts/lib/changed-paths.mjs (local check classification)
// and tests/scripts/ci-path-filters.test.ts (CI paths-filter parity) read one
// list instead of maintaining parallel copies. CI topology itself remains owned
// by .github/workflows/ (see CONTRIBUTING.md#static-build-and-ci-policy).
export const SHARED_BUILD_PATTERNS = Object.freeze([
  "package.json",
  "package-lock.json",
  "tsconfig*.json",
  "vite.config.ts",
  "scripts/build-verified.mjs",
  "scripts/lib/vite-*.mjs",
  "scripts/lib/sentry-release.mjs",
  "scripts/lib/desktop-build-config.mjs",
]);

// Gate-level "documentation-only" definition: every Markdown file plus the
// Docs/, .agents/, and .cursor/ trees. Mirrors the documentation route's
// contract patterns below (including Docs/** for non-Markdown files under
// Docs/) so check classification and verify routing agree — non-Markdown files
// under Docs/ (images, archived plans) still skip code builds in check
// classification.
export function isDocumentationPath(filePath) {
  return filePath.endsWith(".md") || /^(Docs|\.agents|\.cursor)\//u.test(filePath);
}

export const ROUTES = Object.freeze([
  route(
    "documentation",
    ["*.md", "**/*.md", "Docs/**", ".agents/**", ".cursor/**"],
    ["docs-check"],
    [doc("CONTRIBUTING.md", "What to run when you change…", "verification policy")],
    "CONTRIBUTING.md",
  ),
  route(
    "save",
    [
      "src/features/alchemy/shared/storage/**",
      "src/features/alchemy/shared/stores/**",
      "src/app/use-app-save-state.ts",
      "src/app/use-alchemy-bootstrap.ts",
      "src/lib/validation/**",
      "src/lib/content-validation/**",
      "src/lib/active-run-session/**",
      "src/lib/platform-save-backend.ts",
    ],
    ["related", "unit-save"],
    [
      doc("Docs/WORKFLOWS.md", "Change persisted save data", "save workflow"),
      doc("src/features/alchemy/shared/storage/MIGRATIONS.md", "Public save contract", "save compatibility"),
    ],
    "src/features/alchemy/shared/storage/io.ts",
  ),
  route(
    "assets",
    [
      "Raw Assets/**",
      "scripts/assets/**",
      "scripts/**asset*.mjs",
      "scripts/optimize-*.mjs",
      "scripts/sync-*.mjs",
      "scripts/check-generated*.mjs",
      "scripts/lib/process-helpers.mjs",
      "scripts/lib/registry-validation.mjs",
      "src/assets/optimized/**",
      "public/sounds/**",
      "public/Music/**",
      "src/lib/game-data/assets.generated.ts",
      "src/lib/game-data/gear-art.ts",
    ],
    ["related", "assets-check"],
    [doc("Docs/WORKFLOWS-ASSETS.md", null, "asset workflow")],
    "scripts/assets/core-assets.mjs",
    // Release/desktop sync helpers share the sync-* prefix but reproduce no
    // committed asset output; they stay on the tooling route.
    ["scripts/sync-changelog.mjs", "scripts/sync-steam-appid.mjs"],
  ),
  route(
    "desktop",
    [
      "desktop/**",
      "src/lib/desktop-api.ts",
      "src/lib/platform.ts",
      "scripts/**desktop*",
      "scripts/lib/release-checks.mjs",
      "tests/desktop/**",
    ],
    ["related", "unit-desktop"],
    [doc("Docs/RELEASE.md", "Commands", "desktop packaging")],
    "desktop/package-layout.cjs",
  ),
  route(
    "balance",
    ["src/lib/balance/**", "tests/balance/**", "tests/lib/balance/**", "vitest.balance.config.ts"],
    ["related", "report-balance"],
    [doc("Docs/REFERENCE.md", "Balance simulation", "balance verification")],
    "src/lib/balance/report-run.ts",
  ),
  route(
    "performance",
    [
      "performance/**",
      "src/lib/performance/**",
      "tests/performance/**",
      "tests/lib/performance/**",
      "playwright.performance.config.ts",
    ],
    ["related", "unit-performance"],
    [doc("Docs/PERFORMANCE.md", "Workflow", "performance profiling")],
    "performance/metrics.ts",
  ),
  route(
    "tooling",
    [
      "scripts/**",
      "tests/scripts/**",
      "tests/architecture/**",
      ".github/**",
      "package.json",
      "package-lock.json",
      "lefthook.yml",
      "vercel.json",
      "eslint.config.js",
      "eslint/**",
      "tsconfig*.json",
      "vite.config.ts",
      "vitest*.config.ts",
      "playwright*.config.ts",
      "dependency-cruiser.config.mjs",
      "knip*.js",
      "stryker.config.mjs",
    ],
    ["unit-tooling"],
    [doc("Docs/REFERENCE.md", "Tooling ownership", "tooling commands")],
    "scripts/measure-agent-context.mjs",
  ),
  route(
    "runtime",
    ["src/**", "public/**", "index.html"],
    ["related"],
    [doc("Docs/ARCHITECTURE.md", "Directory layout (`src/features/alchemy/`)", "runtime architecture")],
    "src/App.tsx",
  ),
  route(
    "unit-test",
    ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    ["unit-changed"],
    [doc("CONTRIBUTING.md", "Test value and coverage strategy", "test policy")],
    "tests/lib/utils.test.ts",
    ["tests/scripts/**", "tests/architecture/**"],
  ),
  route(
    "browser-test",
    [
      "tests/**/*.spec.ts",
      "tests/e2e/**",
      "tests/electron/**",
      "tests/fixtures/**",
      "tests/pages/**",
      "tests/playwright-*.ts",
      "tests/browser-helpers.ts",
    ],
    [],
    [doc("tests/e2e/README.md", null, "browser test contract")],
    "tests/e2e/specs/core-gameplay.spec.ts",
  ),
]);

const UNKNOWN_ROUTE = Object.freeze({
  id: "unknown",
  patterns: ["**"],
  commands: ["related"],
  docs: [],
  fixture: "unknown.file",
  unknown: true,
});

function normalize(filePath) {
  if (filePath === "") return "";
  // Single repo-relative spelling via the shared path owner; outside paths
  // pass through so cross-checkout reports keep readable hints.
  return toRepoRelative(ROOT_DIR, filePath, { onOutside: "keep-relative" });
}

const COMPILED_ROUTES = ROUTES.map((candidate) => ({
  candidate,
  patterns: candidate.patterns.map(globToRegExp),
  exclude: (candidate.exclude ?? []).map(globToRegExp),
}));

function matches(route, filePath) {
  if (filePath.endsWith(".md") && route.candidate.id !== "documentation") return false;
  return (
    route.patterns.some((expression) => expression.test(filePath)) &&
    !route.exclude.some((expression) => expression.test(filePath))
  );
}

function matchesCandidate(candidate, filePath) {
  const compiled = COMPILED_ROUTES.find((entry) => entry.candidate === candidate);
  return compiled ? matches(compiled, filePath) : false;
}

export function resolveRoutes(paths) {
  const normalized = paths.map(normalize);
  const matched = COMPILED_ROUTES.filter((entry) => normalized.some((filePath) => matches(entry, filePath))).map(
    (entry) => entry.candidate,
  );
  const hasUnknown =
    normalized.length === 0 ||
    normalized.some((filePath) => !COMPILED_ROUTES.some((entry) => matches(entry, filePath)));
  return hasUnknown ? [...matched, UNKNOWN_ROUTE] : matched;
}

function isUnitTest(filePath) {
  return /^tests\/.*\.test\.tsx?$/u.test(filePath);
}

function isRelatedInput(filePath) {
  if (filePath.startsWith("tests/") || filePath.endsWith(".md")) return false;
  return /^(src|scripts|desktop|performance)\//u.test(filePath) || /\.(ts|tsx|js|mjs|cjs)$/u.test(filePath);
}

export function resolveRoutePlan(paths) {
  const normalized = expandRepositoryPaths(ROOT_DIR, paths);
  const routes = resolveRoutes(normalized);
  const keys = new Set(routes.flatMap((candidate) => candidate.commands));
  const coveredPaths = [...keys]
    .filter((key) => key.startsWith("unit-") && key !== "unit-changed")
    .flatMap((key) => COMMANDS[key].args.filter((arg) => arg.startsWith("tests/")));
  const changedTests = normalized.filter(
    (filePath) =>
      isUnitTest(filePath) &&
      existsSync(path.join(ROOT_DIR, filePath)) &&
      !coveredPaths.some((covered) => filePath === covered || filePath.startsWith(`${covered}/`)),
  );
  const tooling = routes.find((candidate) => candidate.id === "tooling");
  const relatedInputs = normalized.filter(
    (filePath) =>
      !isUnitTest(filePath) && isRelatedInput(filePath) && !(tooling && matchesCandidate(tooling, filePath)),
  );
  if (changedTests.length === 0) keys.delete("unit-changed");
  if (relatedInputs.length === 0) keys.delete("related");
  // A first push can select the entire tree. Full unit coverage is cheaper and
  // safer than shell-sized batches of overlapping dependency-related commands.
  // Budget is intentionally separate from the inline CLI-arg budget in check.mjs.
  if (Buffer.byteLength(JSON.stringify([...relatedInputs, ...changedTests])) > 8_000) {
    for (const key of keys) if (key === "related" || key.startsWith("unit-")) keys.delete(key);
    keys.add("unit-all");
  }
  return {
    paths: normalized,
    routes,
    commands: [...keys].map((key) => {
      const command = COMMANDS[key];
      if (key === "unit-changed") return { key, ...command, args: [...command.args, ...changedTests] };
      if (key === "related") {
        return { key, ...command, args: [...command.args, ...relatedInputs, "--run", "--passWithNoTests"] };
      }
      return { key, ...command };
    }),
  };
}

export function validateRouteCatalog({ rootDir = ROOT_DIR } = {}) {
  const errors = [];
  for (const candidate of ROUTES) {
    if (!existsSync(path.join(rootDir, candidate.fixture))) {
      errors.push(`${candidate.id} fixture does not exist: ${candidate.fixture}`);
    }
    for (const owner of candidate.docs) {
      const ownerPath = path.join(rootDir, owner.path);
      if (!existsSync(ownerPath)) errors.push(`${candidate.id} owner document does not exist: ${owner.path}`);
      else if (owner.heading) {
        try {
          readDocumentSection(rootDir, owner.path, owner.heading);
        } catch {
          errors.push(`${candidate.id} owner heading does not exist: ${owner.path}#${owner.heading}`);
        }
      }
    }
  }
  return errors;
}
