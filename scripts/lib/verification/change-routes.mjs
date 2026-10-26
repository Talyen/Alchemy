import { existsSync } from "node:fs";
import path from "node:path";

import { globToRegExp } from "../glob-pattern.mjs";
import { expandRepositoryPaths, REPO_ROOT as ROOT_DIR, toRepoRelative } from "../repository-paths.mjs";
import { COMMANDS } from "./test-commands.mjs";
import { RELATED_SELECTION_BYTES } from "./selection-budgets.mjs";
import { readDocumentSection } from "../agent/markdown-sections.mjs";

function doc(pathname, heading = null, reason = "owner documentation") {
  return { path: pathname, heading, reason };
}

function route(id, patterns, commands, docs, fixture, exclude = []) {
  return Object.freeze({ id, patterns, commands, docs, fixture, exclude });
}

// Shared build inputs that force both web and desktop renderer rebuilds.
// Owned here so scripts/lib/verification/changed-paths.mjs (local check classification)
// and tests/scripts/ci-path-filters.test.ts (CI paths-filter parity) read one
// list instead of maintaining parallel copies. CI topology itself remains owned
// by .github/workflows/ (see CONTRIBUTING.md#static-build-and-ci-policy).
export const SHARED_BUILD_PATTERNS = Object.freeze([
  "game-edition.mjs",
  "package.json",
  "package-lock.json",
  ".node-version",
  ".npmrc",
  "tsconfig*.json",
  "vite.config.ts",
  "public/startup-*.js",
  "src/lib/localization/**",
  "scripts/localization*",
  "scripts/localization/**",
  "scripts/build-verified.mjs",
  "scripts/check-bundle-budget.mjs",
  "scripts/lib/verification/bundle-budget.mjs",
  "scripts/lib/storage-footprint.mjs",
  "scripts/lib/command-invocation.mjs",
  "scripts/lib/run-command.mjs",
  "scripts/lib/script-run.mjs",
  "scripts/lib/repo-package.mjs",
  "scripts/lib/is-main-module.mjs",
  "scripts/lib/repository-paths.mjs",
  "scripts/lib/vite-*.mjs",
  "scripts/lib/release/sentry-release.mjs",
  "scripts/lib/release/desktop-build-config.mjs",
  "scripts/lib/release/game-edition.mjs",
]);

// Gate-level "documentation-only" definition: every Markdown file plus the
// Docs/ and .agents/ trees. Mirrors the documentation route's
// contract patterns below (including Docs/** for non-Markdown files under
// Docs/) so check classification and verify routing agree — non-Markdown files
// under Docs/ (images, archived plans) still skip code builds in check
// classification.
function isDocumentationPath(filePath) {
  return filePath.endsWith(".md") || /^(Docs|\.agents)\//u.test(filePath);
}

const ROUTES = Object.freeze([
  route(
    "interactions",
    [
      "src/app/**",
      "src/features/alchemy/**",
      "src/lib/animation/**",
      "src/lib/routing/**",
      "src/lib/platform-save-backend.ts",
      "src/lib/preload/image.ts",
      "tests/interaction/**",
      "scripts/run-interactions.mjs",
    ],
    ["unit-interactions"],
    [doc("tests/interaction/README.md", null, "connected progress coverage")],
    "tests/interaction/sequence.ts",
  ),
  route(
    "documentation",
    ["*.md", "**/*.md", "Docs/**", ".agents/**"],
    ["docs-check"],
    [doc("CONTRIBUTING.md", "What to run when you change…", "verification policy")],
    "CONTRIBUTING.md",
  ),
  route(
    "save",
    [
      "src/features/alchemy/shared/storage/**",
      "src/features/alchemy/shared/stores/**",
      "src/app/*save*.ts",
      "src/app/use-alchemy-bootstrap.ts",
      "src/lib/validation/**",
      "src/lib/content-validation/**",
      "src/lib/active-run-session/**",
      "src/lib/platform-save-backend.ts",
    ],
    ["related", "unit-save"],
    [
      doc("Docs/RUN_WORKFLOWS.md", "Change persisted save data", "save workflow"),
      doc("src/features/alchemy/shared/storage/MIGRATIONS.md", "Public save contract", "save compatibility"),
    ],
    "src/features/alchemy/shared/storage/io.ts",
  ),
  route(
    "assets",
    [
      "assets/sources/**",
      "scripts/assets/**",
      "scripts/**asset*.mjs",
      "scripts/optimize-*.mjs",
      "scripts/sync-*.mjs",
      "scripts/check-generated*.mjs",
      "scripts/generate-icons.mjs",
      "scripts/lib/process-helpers.mjs",
      "scripts/lib/cli-args.mjs",
      "scripts/lib/is-main-module.mjs",
      "scripts/lib/map-pool.mjs",
      "scripts/lib/repo-package.mjs",
      "scripts/lib/script-run.mjs",
      "scripts/lib/write-text-if-changed.mjs",
      "desktop/icons/**",
      "src/assets/optimized/**",
      "public/sounds/**",
      "public/Music/**",
      "public/favicon*",
      "public/icon-*",
      "public/apple-touch-icon.png",
      "public/site.webmanifest",
      "src/lib/game-data/assets.generated.ts",
      "src/lib/game-data/catalog-art.ts",
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
      "game-edition.mjs",
      "desktop/**",
      "src/lib/desktop-api.ts",
      "src/lib/platform.ts",
      "scripts/**desktop*",
      "scripts/ensure-steamworks*",
      "scripts/steamworks/*.patch",
      "scripts/lib/release/release-checks.mjs",
      "scripts/lib/release/game-edition.mjs",
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
    [doc("Docs/SIMULATION.md", "Balance simulation", "balance verification")],
    "src/lib/balance/report-run.ts",
  ),
  route(
    "performance",
    [
      "performance/**",
      "src/lib/performance/**",
      "scripts/run-performance.mjs",
      "scripts/lib/performance/**",
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
      "game-edition.mjs",
      "scripts/**",
      "tests/scripts/**",
      "tests/architecture/**",
      ".github/**",
      "package.json",
      "package-lock.json",
      ".node-version",
      ".npmrc",
      "lefthook.yml",
      "vercel.json",
      "oxlint.config.ts",
      "lint/**",
      "tsconfig*.json",
      "vite.config.ts",
      "vitest*.config.ts",
      "playwright*.config.ts",
      "dependency-cruiser*.mjs",
      "knip*.js",
      "stryker.config.mjs",
    ],
    ["unit-tooling"],
    [doc("Docs/COMMANDS.md", "Script Command Reference", "tooling commands")],
    "scripts/check.mjs",
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
  // Presentation changes retain dependency-related coverage. Explicit lifecycle
  // hooks still select families, and unfamiliar behavior owners keep the fallback.
  if (
    route.candidate.id === "interactions" &&
    (/^src\/features\/alchemy\/.*\/screens\//u.test(filePath) ||
      /^src\/features\/alchemy\/shared\/(?:ui|config|types)\//u.test(filePath) ||
      /^src\/app\/playthrough\//u.test(filePath)) &&
    !/\/use-[^/]+\.[jt]sx?$/u.test(filePath)
  )
    return false;
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

// Shared lifecycle seams retain the whole interaction suite. Feature owners
// select their lifecycle families; dependency-related selection still finds
// other affected interaction tests through actual imports.
const INTERACTION_SCOPES = [
  [
    /^src\/features\/alchemy\/(?:run-loop\/battle\/|shell\/use-battle-controller\.ts$|run-loop\/screens\/battle-screen\/)/u,
    ["battle", "overlays", "audio-progress", "timing"],
  ],
  [
    /^src\/features\/alchemy\/meta\/(?:screens\/armory(?:\/|-screen\.)|screens\/homestead(?:\/|-screen\.)|screens\/talents-screen\.|talents\/)/u,
    ["armory", "navigation"],
  ],
  [/^src\/features\/alchemy\/meta\/screens\/options(?:\/|-screen\.)/u, ["navigation", "overlays"]],
  [/^src\/features\/alchemy\/meta\/screens\//u, ["navigation", "overlays", "startup"]],
  [/^src\/features\/alchemy\/run-setup\//u, ["navigation"]],
  [/^src\/features\/alchemy\/run-loop\//u, ["visits", "navigation"]],
  [/^src\/features\/alchemy\/shell\//u, ["navigation", "battle"]],
  [/^src\/features\/alchemy\/shared\/storage\//u, ["persistence"]],
  [/^src\/(?:app\/autosave|lib\/platform-save-backend\.ts$)/u, ["persistence"]],
  [/^src\/lib\/preload\/image\.ts$/u, ["startup", "overlays"]],
  [/^src\/lib\/routing\//u, ["navigation"]],
];

function interactionSuites(paths, routes) {
  if (!routes.some((candidate) => candidate.id === "interactions")) return [];
  const suites = new Set();
  const interactionRoute = routes.find((candidate) => candidate.id === "interactions");
  for (const filePath of paths.filter((file) => matchesCandidate(interactionRoute, file))) {
    if (isUnitTest(filePath)) {
      if (!existsSync(path.join(ROOT_DIR, filePath))) return ["tests/interaction"];
      suites.add(filePath);
      continue;
    }
    const scope = INTERACTION_SCOPES.find(([pattern]) => pattern.test(filePath));
    if (!scope) return ["tests/interaction"];
    for (const family of scope[1]) {
      const extension = family === "battle" || family === "overlays" ? "tsx" : "ts";
      suites.add(`tests/interaction/${family}.dom.test.${extension}`);
    }
  }
  return [...suites].sort();
}

export function resolveRoutePlan(paths) {
  const normalized = expandRepositoryPaths(ROOT_DIR, paths);
  const routes = resolveRoutes(normalized);
  const keys = new Set(routes.flatMap((candidate) => candidate.commands));
  const interactions = interactionSuites(normalized, routes);
  if (interactions.length === 0) keys.delete("unit-interactions");
  const selectedCommand = (key) =>
    key === "unit-interactions"
      ? { ...COMMANDS[key], args: ["run", "test:unit", "--", ...interactions] }
      : COMMANDS[key];
  const coveredPaths = [...keys]
    .filter((key) => key.startsWith("unit-") && key !== "unit-changed")
    .flatMap((key) => selectedCommand(key).args.filter((arg) => arg.startsWith("tests/")));
  const changedTests = normalized.filter(
    (filePath) =>
      isUnitTest(filePath) &&
      existsSync(path.join(ROOT_DIR, filePath)) &&
      !coveredPaths.some((covered) => filePath === covered || filePath.startsWith(`${covered}/`)),
  );
  const tooling = routes.find((candidate) => candidate.id === "tooling");
  const relatedInputs = normalized.filter(
    (filePath) =>
      !isUnitTest(filePath) &&
      isRelatedInput(filePath) &&
      !(tooling && matchesCandidate(tooling, filePath)) &&
      // Profiling drivers have a complete explicit unit owner. Runtime marks
      // under src/ retain graph selection for their gameplay consumers.
      !(keys.has("unit-performance") && filePath.startsWith("performance/")),
  );
  if (changedTests.length === 0) keys.delete("unit-changed");
  if (relatedInputs.length === 0) keys.delete("related");
  // A first push can select the entire tree. Full unit coverage is cheaper and
  // safer than shell-sized batches of overlapping dependency-related commands.
  // Budget is intentionally separate from the inline CLI-arg budget in check.mjs
  // (see lib/verification/selection-budgets.mjs: same value, different meaning).
  if (Buffer.byteLength(JSON.stringify([...relatedInputs, ...changedTests])) > RELATED_SELECTION_BYTES) {
    for (const key of keys) if (key === "related" || key.startsWith("unit-")) keys.delete(key);
    keys.add("unit-all");
  }
  return {
    paths: normalized,
    classification: classifyVerificationPaths(normalized),
    routes,
    commands: [...keys].map((key) => {
      const command = selectedCommand(key);
      if (key === "unit-changed") return { key, ...command, args: [...command.args, ...changedTests] };
      if (key === "related") {
        return {
          key,
          ...command,
          args: [
            ...command.args,
            ...relatedInputs,
            ...(keys.has("unit-interactions")
              ? interactions.flatMap((suite) => ["--exclude", suite === "tests/interaction" ? `${suite}/**` : suite])
              : []),
            "--run",
            "--passWithNoTests",
          ],
        };
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
    for (const commandKey of candidate.commands) {
      if (!COMMANDS[commandKey]) {
        errors.push(`${candidate.id} references unknown command: ${commandKey}`);
      }
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

const COMPILED_SHARED_BUILD_PATTERNS = SHARED_BUILD_PATTERNS.map(globToRegExp);

function classifyVerificationPaths(paths) {
  const expanded = paths;
  const codePaths = expanded.filter((filePath) => !isDocumentationPath(filePath));
  const routes = resolveRoutes(codePaths.length > 0 ? codePaths : expanded);
  const ids = new Set(routes.map((route) => route.id));
  const needsCodeChecks = codePaths.length > 0;
  const lockfile = codePaths.some((filePath) => filePath === "package.json" || filePath === "package-lock.json");
  const sharedBuild = codePaths.some((filePath) =>
    COMPILED_SHARED_BUILD_PATTERNS.some((expression) => expression.test(filePath)),
  );
  // Extraction scans source literals and derives descriptions from runtime modules.
  // Test/tooling-only changes do not affect those catalogs; integration and
  // pre-push still select this gate for every changed localization input.
  const localization = codePaths.some((filePath) =>
    /^(?:src\/.*\.[cm]?[jt]sx?$|src\/lib\/localization\/|scripts\/localization(?:[./])|steam\/|public\/fonts\/|package(?:-lock)?\.json$|vite\.config\.ts$)/u.test(
      filePath,
    ),
  );
  const desktop = ids.has("desktop") || sharedBuild;
  const web =
    sharedBuild ||
    ids.has("runtime") ||
    ids.has("assets") ||
    codePaths.some((filePath) =>
      /^(src\/|public\/|index\.html$|vite\.config\.ts$|vercel\.json$|package\.json$|package-lock\.json$)/u.test(
        filePath,
      ),
    );
  return { needsCodeChecks, lockfile, desktop, web, localization, routeIds: [...ids] };
}
