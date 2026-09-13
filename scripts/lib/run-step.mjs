import path from "node:path";
import { commandExposure, failureSummary, writeFailureDigest } from "./compact-output.mjs";

/**
 * Shared reporting for scripts/check.mjs and scripts/verify-changed.mjs.
 * Execution stays with the callers (verify owns receipts and streaming;
 * check owns its injected test runner); this module owns the single
 * exposure + digest policy applied to a finished child command.
 */
export function summarizeStepResult(command, result, { verbose = false } = {}) {
  const output = String(result?.output ?? "");
  if (verbose && output) process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  const failureOutput = (result?.status ?? 1) === 0 ? "" : failureSummary(output);
  const exposure = commandExposure({
    key: command.key,
    label: command.label,
    command: `${command.command} ${command.args.join(" ")}`,
    result: { ...result, output },
    exposedOutput: (verbose ? output : "") + failureOutput,
    budgetBytes: verbose ? null : undefined,
  });
  return { exposure, failureOutput };
}

/**
 * Summarize a failed step, write its bounded digest, and print the standard
 * `Failure digest:` / `Full log:` lines. Returns exposure plus digest paths.
 * Success/failure bookkeeping stays with the callers.
 */
export function summarizeAndReportFailure(
  reportsDir,
  command,
  result,
  runId,
  index,
  rootDir = process.cwd(),
  options = {},
) {
  const { exposure, failureOutput } = summarizeStepResult(command, result, options);
  const { digestPath, logPath } = writeFailureDigest(reportsDir, command, result, runId, index);
  console.error(`  ${failureOutput}`);
  console.error(`  Failure digest: ${path.relative(rootDir, digestPath)}`);
  console.error(`  Full log: ${path.relative(rootDir, logPath)}`);
  return { exposure, failureOutput, digestPath, logPath };
}
