import { commandExposure, failureSummary } from "./compact-output.mjs";

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
