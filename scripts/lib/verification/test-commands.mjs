import { VITEST_MAX_WORKERS } from "./test-concurrency.mjs";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

// Core save/persistence suites; the two save-migration architecture tests live
// under tests/architecture, so the ship gate picks them up via tooling below.
// The scheduler math and autosave-allowed selector suites are listed
// explicitly: vitest "related" selection would usually find them, but the save
// gate must not depend on import-graph luck for its timing core.
const SAVE_CORE_SUITES = Object.freeze([
  "tests/features/alchemy/shared/storage",
  "tests/app/autosave-hook.test.ts",
  "tests/app/autosave-active-run.test.ts",
  "tests/app/autosave-scheduler.test.ts",
  "tests/features/alchemy/shared/stores/select-autosave-allowed.test.ts",
  "tests/lib/validation",
  "tests/lib/active-run-session",
]);

export const TEST_SUITES = Object.freeze({
  local: Object.freeze([
    "tests/lib/rng.test.ts",
    "tests/app/autosave-scheduler.test.ts",
    "tests/scripts/local-verification.test.ts",
  ]),
  save: Object.freeze([
    ...SAVE_CORE_SUITES,
    "tests/architecture/save-migration-guard.test.ts",
    "tests/architecture/save-migration-contract.test.ts",
  ]),
  tooling: Object.freeze(["tests/scripts", "tests/architecture"]),
  shipUnit: Object.freeze([...SAVE_CORE_SUITES, "tests/scripts", "tests/architecture"]),
});

function hasTestFiles(filename) {
  const stats = statSync(filename, { throwIfNoEntry: false });
  if (!stats) return false;
  if (stats.isFile()) return /\.test\.tsx?$/u.test(filename);
  if (!stats.isDirectory()) return false;
  return readdirSync(filename, { withFileTypes: true }).some((entry) =>
    entry.isDirectory()
      ? hasTestFiles(path.join(filename, entry.name))
      : entry.isFile() && /\.test\.tsx?$/u.test(entry.name),
  );
}

export function validateTestSuitePaths(rootDir, suites = TEST_SUITES.shipUnit) {
  return suites.filter((entry) => !hasTestFiles(path.join(rootDir, entry)));
}

export const COMMANDS = Object.freeze({
  "unit-local": {
    label: "local Node smoke",
    reason: "bounded local checks; full validation belongs to CI",
    command: NPM,
    args: ["test"],
  },
  "unit-all": {
    label: "complete unit suite",
    reason: "large selections use full coverage without exceeding platform argument limits",
    command: NPM,
    args: ["run", "test:full"],
  },
  related: {
    label: "dependency-related unit tests",
    reason: "Vitest selects tests that import the changed implementation",
    command: process.execPath,
    args: ["scripts/run-compact.mjs", "vitest", "related", `--maxWorkers=${VITEST_MAX_WORKERS}`],
  },
  "unit-changed": {
    label: "changed unit tests",
    reason: "changed Vitest files execute directly",
    command: process.execPath,
    args: ["scripts/run-compact.mjs", "vitest", "run"],
  },
  "unit-save": {
    label: "save/persistence unit tests",
    reason: "save changes preserve schema, storage, autosave, and hydration behavior",
    command: NPM,
    args: ["run", "test:full", "--", ...TEST_SUITES.save],
  },
  "unit-desktop": {
    label: "desktop boundary unit tests",
    reason: "desktop changes preserve security, crash reporting, and package layout",
    command: NPM,
    args: [
      "run",
      "test:full",
      "--",
      "tests/desktop/desktop-security.test.ts",
      "tests/desktop/desktop-sentry.test.ts",
      "tests/desktop/desktop-package-layout.test.ts",
    ],
  },
  "unit-tooling": {
    label: "tooling and architecture unit tests",
    reason: "tooling checks read repository files and cannot be selected reliably from imports alone",
    command: NPM,
    args: ["run", "test:full", "--", ...TEST_SUITES.tooling],
  },
  "unit-performance": {
    label: "performance harness unit tests",
    reason: "performance harness and runtime marks share profiling contracts",
    command: NPM,
    args: ["run", "test:full", "--", "tests/performance", "tests/lib/performance"],
  },
  "report-balance": {
    label: "balance report integration",
    reason: "balance changes construct and render the complete report",
    command: NPM,
    args: ["run", "test:balance"],
  },
  "assets-check": {
    label: "prepared asset verification",
    reason: "committed selections, settings, output bytes and generated code are consistent",
    command: NPM,
    args: ["run", "assets:check:outputs"],
  },
  "docs-check": {
    label: "documentation checks",
    reason: "documentation and agent policy preserve their contracts",
    command: NPM,
    args: ["run", "docs:check"],
  },
});

// Keyed separately so plan filtering never depends on a string literal that can
// drift from the COMMANDS table above.
export const DOCS_CHECK_KEY = "docs-check";
