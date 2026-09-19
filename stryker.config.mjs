/**
 * Battle mutation policy
 * ----------------------
 * Scope is the damage-calculation core module (the nightly step's stated
 * purpose), scored against the break threshold below. Mutating all of
 * src/lib/battle yields ~8.5k mutants, which cannot complete inside the
 * nightly cap; the vitest runner keeps per-mutant cost proportional via
 * per-test coverage selection instead of re-running the whole battle suite
 * for every mutant. Measured: ~640 mutants, ~30 min locally. Expand the
 * scope only with throughput to stay inside the nightly timeout.
 */
/** @type {import("@stryker-mutator/core").PartialStrykerOptions} */
export default {
  packageManager: "npm",
  testRunner: "vitest",
  coverageAnalysis: "perTest",
  mutate: ["src/lib/battle/damage-calc.ts"],
  reporters: ["html", "clear-text", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  thresholds: { high: 80, low: 50, break: 50 },
  timeoutMS: 20_000,
  concurrency: 4,
  disableTypeChecks: true,
  ignoreStatic: true,
  // Static source-text assertions (tests/architecture) read file contents, so
  // they assert against Stryker's instrumented sandbox copies instead of real
  // behavior. They provide no mutant-killing coverage and always fail there,
  // so keep them out of the sandbox; CI still runs them normally.
  ignorePatterns: ["dist", "coverage", "reports", "test-results", "playwright-report", "tests/architecture/**"],
};
