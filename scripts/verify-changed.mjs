#!/usr/bin/env node
/** Select dependency-related tests plus a small set of risk-based escalations. */
import path from "node:path";
import fs from "node:fs";

import { commandExposure, failureSummary, writeFailureDigest } from "./lib/compact-output.mjs";
import { resolveRoutePlan } from "./lib/change-routes.mjs";
import { parseChangedPathsArgs, resolveSelectedPaths } from "./lib/changed-paths.mjs";
import { ensureRunId, writeCurrentRun } from "./lib/current-run.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { runCommand } from "./lib/run-command.mjs";
import { recordAgentEvent } from "./lib/agent-events.mjs";
import { captureVerificationInputs, createVerificationCache } from "./lib/verification-cache.mjs";
import { selectContext } from "./lib/agent-context.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

const VERIFY_FLAGS = new Set(["diff", "plan", "verbose-plan", "verbose", "keep-going"]);

export function parseVerifyArgs(argv) {
  const { flags, paths } = parseChangedPathsArgs(argv, {
    usage: "Provide paths or use --diff. Example: npm run verify -- --diff --plan",
  });
  for (const flag of flags) {
    if (!VERIFY_FLAGS.has(flag)) throw new Error(`Unknown verify option: --${flag}`);
  }
  return { flags, paths: resolveSelectedPaths(ROOT, { flags, paths }) };
}

export function formatPlan(plan, { verbosePlan = false } = {}) {
  const lines = [`Changed paths: ${plan.paths.length}`];
  for (const filePath of plan.paths.slice(0, 20)) lines.push(`  ${filePath}`);
  if (plan.paths.length > 20) lines.push(`  … ${plan.paths.length - 20} more paths`);
  lines.push(`Categories: ${plan.routes.map((route) => route.id).join(", ") || "none"}`);
  if (plan.routes.some((route) => route.unknown)) {
    lines.push("Note: uncategorized paths receive dependency-related test selection when applicable.");
  }
  const owners = selectContext(plan.paths).docs;
  if (owners.length) {
    lines.push("Owners (npm run context -- <paths> prints the sections):");
    for (const owner of owners.slice(0, 6)) lines.push(`  ${owner.path}${owner.heading ? ` § ${owner.heading}` : ""}`);
    if (owners.length > 6) lines.push(`  … ${owners.length - 6} more owners; use context for the complete selection`);
  }
  lines.push("Commands:");
  if (plan.commands.length === 0) lines.push("  none");
  for (const command of plan.commands) {
    lines.push(`  ${command.key}: ${command.label} — ${command.reason}`);
    if (verbosePlan) lines.push(`    ${command.command} ${command.args.join(" ")}`);
  }
  return `${lines.join("\n")}\n`;
}

function runVerificationCommand(command, index, verbose, runId, sessionInputs) {
  const result = runCommand(command.command, command.args, {
    cwd: ROOT,
    env: { ...process.env, ALCHEMY_RUN_ID: runId },
    shell: process.platform === "win32",
    stdio: ["inherit", "pipe", "pipe"],
  });
  // sessionInputs is captured once per process (see main); one post-command
  // capture decides whether the diagnostic event is trustworthy.
  if (sessionInputs !== null && sessionInputs === captureVerificationInputs(ROOT))
    recordAgentEvent(ROOT, {
      kind: "diagnostic",
      command: JSON.stringify([command.command, command.args]),
      inputHash: sessionInputs,
      status: result.status === 0 ? "passed" : "failed",
    });
  const verboseOutput = verbose && result.output ? result.output : "";
  if (verboseOutput) process.stdout.write(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
  const failureOutput = result.status === 0 ? "" : failureSummary(result.output);
  const exposure = commandExposure({
    key: command.key,
    label: command.label,
    command: `${command.command} ${command.args.join(" ")}`,
    result,
    exposedOutput: verboseOutput + failureOutput,
    budgetBytes: verbose ? null : undefined,
  });
  if (result.status === 0 && !exposure.overBudget) {
    console.log(`✓ ${command.label} (${(result.elapsedMs / 1000).toFixed(1)}s, run ${runId})`);
    return { passed: true, command, result, exposure };
  }
  if (exposure.overBudget && result.status === 0) {
    // Intentional: verify fails passing-but-chatty commands so routine output
    // stays bounded; check only fails on non-zero exit. Keep both policies.
    console.error(`✗ ${command.label} exceeded the routine output budget (run ${runId})`);
    return { passed: false, exposureFailure: true, command, result, exposure };
  }
  const reportsDir = path.join(ROOT, "reports", "runs", runId, "verify");
  const { digestPath, logPath } = writeFailureDigest(reportsDir, command, result, runId, index);
  console.error(`✗ ${command.label} (${(result.elapsedMs / 1000).toFixed(1)}s, exit ${result.status ?? "unknown"})`);
  console.error(`  ${failureOutput}`);
  console.error(`  Failure digest: ${path.relative(ROOT, digestPath)}`);
  console.error(`  Full log: ${path.relative(ROOT, logPath)}`);
  return { passed: false, command, result, exposure, digestPath, logPath };
}

export function main(argv = process.argv.slice(2)) {
  const runId = ensureRunId("verify");
  try {
    const { flags, paths } = parseVerifyArgs(argv);
    const plan = resolveRoutePlan(paths);
    console.log(`Run: ${runId}`);
    process.stdout.write(formatPlan(plan, { verbosePlan: flags.has("verbose-plan") }));
    if (flags.has("plan")) return 0;

    const cache = createVerificationCache(ROOT, plan.commands);
    const sessionInputs = process.env.ALCHEMY_AGENT_SESSION ? captureVerificationInputs(ROOT) : null;
    const outcomes = [];
    for (const [index, command] of plan.commands.entries()) {
      const receipt = cache.read(command);
      const outcome = receipt
        ? { passed: true, command, reused: receipt.runId }
        : runVerificationCommand(command, index, flags.has("verbose"), runId, sessionInputs);
      if (receipt) console.log(`✓ ${command.label} (reused passing run ${receipt.runId}; inputs unchanged)`);
      recordAgentEvent(ROOT, {
        kind: "verification",
        command: JSON.stringify([command.command, command.args]),
        status: receipt ? "reused" : outcome.passed ? "passed" : "failed",
      });
      outcomes.push(outcome);
      if (!outcome.passed && !flags.has("keep-going")) break;
    }
    const stable = cache.finish(outcomes, runId);
    if (!stable) {
      console.error("Verification inputs changed during the run; rerun for current inputs.");
      outcomes.push({ passed: false, command: { label: "verification input staleness" } });
    }
    const failed = outcomes.filter((outcome) => !outcome.passed);
    const artifacts = failed.flatMap((outcome) =>
      outcome.digestPath && outcome.logPath
        ? [
            { path: outcome.digestPath, role: "primary" },
            { path: outcome.logPath, role: "secondary" },
          ]
        : [],
    );
    const summaryPath = path.join(ROOT, "reports/runs", runId, "verify/summary.json");
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        outcomes.map((outcome) => ({
          command: outcome.command.key ?? outcome.command.label,
          status: outcome.passed ? "passed" : "failed",
          reusedFromRun: outcome.reused ?? null,
          durationMs: outcome.result?.elapsedMs ?? 0,
        })),
        null,
        2,
      ) + "\n",
    );
    artifacts.push({ path: summaryPath, role: "secondary" });
    writeCurrentRun({
      rootDir: ROOT,
      runId,
      status: failed.length > 0 ? "failed" : "passed",
      command: "npm run verify",
      artifacts,
      counts: { passed: outcomes.length - failed.length, failed: failed.length },
      commandExposures: outcomes.flatMap((outcome) => (outcome.exposure ? [outcome.exposure] : [])),
      steps: outcomes.map((outcome) => ({
        label: outcome.command.label,
        status: outcome.passed ? "passed" : "failed",
        durationMs: outcome.result?.elapsedMs ?? 0,
        ...(outcome.reused ? { reason: `Reused passing run ${outcome.reused}; inputs unchanged` } : {}),
      })),
      summary:
        failed.length > 0
          ? `${failed[0].command.label} failed; inspect its bounded digest first.`
          : `${outcomes.length}/${outcomes.length} verification steps passed.`,
    });
    return failed.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (isMainModule(import.meta.url)) {
  const code = main();
  if (code !== 0) process.exitCode = code;
}
