import { globSync } from "node:fs";

/**
 * Shared Vitest suite paths used by changed-path routing and the ship gate.
 * Keep directory entries broad only where the owning workflow already treats
 * the directory as one contract; individual files belong in the route catalog.
 */
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
    "tests/architecture",
    "tests/scripts",
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
