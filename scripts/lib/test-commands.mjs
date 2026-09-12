import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

// Core save/persistence suites; the two save-migration architecture tests live
// under tests/architecture, so the ship gate picks them up via tooling below.
const SAVE_CORE_SUITES = Object.freeze([
  "tests/features/alchemy/shared/storage",
  "tests/app/autosave-hook.test.ts",
  "tests/app/autosave-active-run.test.ts",
  "tests/lib/validation",
  "tests/lib/active-run-session",
]);

export const TEST_SUITES = Object.freeze({
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
  "unit-all": {
    label: "complete unit suite",
    reason: "large selections use full coverage without exceeding platform argument limits",
    command: NPM,
    args: ["test"],
  },
  related: {
    label: "dependency-related unit tests",
    reason: "Vitest selects tests that import the changed implementation",
    command: "npx",
    args: ["vitest", "related"],
  },
  "unit-changed": {
    label: "changed unit tests",
    reason: "changed Vitest files execute directly",
    command: "npx",
    args: ["vitest", "run"],
  },
  "unit-save": {
    label: "save/persistence unit tests",
    reason: "save changes preserve schema, storage, autosave, and hydration behavior",
    command: NPM,
    args: ["test", "--", ...TEST_SUITES.save],
  },
  "unit-desktop": {
    label: "desktop boundary unit tests",
    reason: "desktop changes preserve security, crash reporting, and package layout",
    command: NPM,
    args: [
      "test",
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
    args: ["test", "--", ...TEST_SUITES.tooling],
  },
  "unit-performance": {
    label: "performance harness unit tests",
    reason: "performance harness and runtime marks share profiling contracts",
    command: NPM,
    args: ["test", "--", "tests/performance", "tests/lib/performance"],
  },
  "report-balance": {
    label: "balance report integration",
    reason: "balance changes construct and render the complete report",
    command: NPM,
    args: ["run", "test:balance"],
  },
  "assets-check": {
    label: "prepared asset verification",
    reason: "asset sources and helpers reproduce committed outputs",
    command: NPM,
    args: ["run", "assets:check"],
  },
  "docs-check": {
    label: "documentation checks",
    reason: "documentation and agent policy preserve their contracts",
    command: NPM,
    args: ["run", "docs:check"],
  },
});
