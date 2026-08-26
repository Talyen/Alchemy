/** @type {import("@stryker-mutator/core").PartialStrykerOptions} */
export default {
  packageManager: "npm",
  testRunner: "command",
  commandRunner: {
    command: "npx vitest run tests/lib/battle --reporter=dot",
  },
  mutate: ["src/lib/battle/damage-calc.ts", "src/lib/battle/dot-resolve.ts"],
  reporters: ["html", "clear-text", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  thresholds: { high: 80, low: 50, break: 0 },
  timeoutMS: 20_000,
  concurrency: 4,
  disableTypeChecks: true,
  ignoreStatic: true,
  ignorePatterns: ["dist", "coverage", "reports", "test-results", "playwright-report"],
};
