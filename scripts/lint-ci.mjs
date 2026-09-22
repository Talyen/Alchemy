#!/usr/bin/env node
/** Compact aggregate static gate; complete child output stays in reports. */
import path from "node:path";
import { ensureRunId } from "./lib/verification/current-run.mjs";
import { completionCounts, failureSummary } from "./lib/compact-output.mjs";
import { runCommandAsync } from "./lib/run-command.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const STEPS = [
  ["static checks", "npm", ["run", "check:static"]],
  ["documentation checks", "npm", ["run", "docs:check"]],
  ["dead code", "npm", ["run", "deadcode"]],
  ["dependency boundaries", "npm", ["run", "lint:boundaries"]],
  ["architecture smoke", "npm", ["run", "lint:architecture-smoke"]],
  ["Playwright collection", "npx", ["playwright", "test", "--list", "--project=chromium"]],
];

export async function runCiLint({ rootDir = ROOT, runner = runCommandAsync } = {}) {
  const runId = ensureRunId("lint-ci");
  const reportDir = path.join(rootDir, "reports", "runs", runId, "lint-ci");
  const outcomes = await Promise.all(
    STEPS.map(async ([label, command, args]) => ({
      label,
      result: await runner(command, args, {
        cwd: rootDir,
        logPath: path.join(reportDir, `${label.replaceAll(/[^a-z0-9]+/giu, "-")}.log`),
      }),
    })),
  );
  let failed = 0;
  for (const { label, result } of outcomes) {
    const status = result.status ?? 1;
    const counts = completionCounts(result.output);
    console.log(`\n${status === 0 ? "PASS" : "FAIL"} ${label} (${(result.elapsedMs / 1000).toFixed(1)}s)`);
    if (counts) console.log(counts);
    if (status !== 0) {
      failed++;
      console.error(failureSummary(result.output));
    }
    console.log(`Full log: ${path.relative(rootDir, result.logPath)}`);
  }
  console.log(`\nCI static checks: ${STEPS.length - failed}/${STEPS.length} passed`);
  return failed === 0 ? 0 : 1;
}

if (isMainModule(import.meta.url)) {
  runCiLint().then((code) => {
    process.exitCode = code;
  });
}
