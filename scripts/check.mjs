#!/usr/bin/env node
/** Source-aware local completion gate with one complete run record. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { changedGitPaths, ensureRunId, writeCurrentRun } from "./lib/verification/current-run.mjs";
import { summarizeAndReportFailure, summarizeStepResult } from "./lib/run-step.mjs";
import {
  parseChangedPathsArgs,
  resolveSelectedPaths,
  resolvePushPaths,
  taskComparisonBase,
} from "./lib/verification/changed-paths.mjs";
import { registerArtifactSession } from "./lib/artifact-guard.mjs";
import { pruneExpiredArtifacts } from "./prune-transient-artifacts.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { runGit, expandRepositoryPaths } from "./lib/repository-paths.mjs";
import { LOCAL_CHECK_INPUTS } from "./lib/verification/test-commands.mjs";
import { runCommandAsync } from "./lib/run-command.mjs";
import { INLINE_ARGS_BYTES } from "./lib/verification/selection-budgets.mjs";
import { resolveCheckPlan } from "./lib/verification/check-plan.mjs";
import { createVerificationCache } from "./lib/verification/verification-cache.mjs";
import { assertHeavyLocalAllowed } from "./lib/verification/local-execution-policy.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function gitOutput(args, rootDir = ROOT) {
  const result = runGit(rootDir, args);
  if (result.status !== 0)
    throw new Error(`Could not capture source revision: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}

function hashPath(relativePath, rootDir) {
  try {
    const stats = fs.lstatSync(path.join(rootDir, relativePath));
    if (stats.isSymbolicLink()) return `symlink:${stats.mode}:${fs.readlinkSync(path.join(rootDir, relativePath))}`;
    if (!stats.isFile()) return `other:${stats.mode.toString(8)}`;
    return crypto
      .createHash("sha256")
      .update(String(stats.mode))
      .update(fs.readFileSync(path.join(rootDir, relativePath)))
      .digest("hex");
  } catch (error) {
    if (error.code === "ENOENT") return "missing";
    throw error;
  }
}

export function captureSourceDigest({ paths: selected, rootDir = ROOT, inputs = LOCAL_CHECK_INPUTS } = {}) {
  const head = gitOutput(["rev-parse", "HEAD"], rootDir).trim();
  for (const input of selected ? inputs : []) {
    if (!fs.existsSync(path.join(rootDir, input))) throw new Error(`Required check input is missing: ${input}`);
  }
  const paths = selected
    ? [...new Set(expandRepositoryPaths(rootDir, [...selected, ...inputs]))]
    : changedGitPaths(rootDir);
  if (selected && paths) {
    const changes = gitOutput(["diff", "HEAD", "--name-status", "--find-renames", "-z"], rootDir).split("\0");
    for (let index = 0; index < changes.length; ) {
      const status = changes[index++];
      const first = changes[index++];
      if (status?.startsWith("R")) {
        const second = changes[index++];
        if (first && second && (paths.includes(first) || paths.includes(second))) paths.push(first, second);
      }
    }
  }
  if (!head || paths === null) throw new Error("Could not capture source state: git status or HEAD is unavailable");
  const payload = [
    head,
    ...[...new Set(paths)].sort().map((filePath) => `${filePath}:${hashPath(filePath, rootDir)}`),
  ].join("\0");
  return {
    head,
    hash: crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16),
    scope: selected ? "task selection and local harness" : "checkout-wide",
  };
}

export function parseCheckArgs(argv) {
  if (argv.every((arg) => ["--plan", "--full"].includes(arg))) argv = ["--task", ...argv];
  if (argv.includes("--pre-push")) {
    if (argv.length !== 1) throw new Error("--pre-push cannot be combined with other selections");
    if (process.stdin.isTTY) throw new Error("--pre-push requires Git hook input on stdin");
    return resolvePushPaths(ROOT, fs.readFileSync(0, "utf8"));
  }
  const { flags, paths, revision } = parseChangedPathsArgs(argv, {
    usage: "Provide --task, paths, --diff, or --committed <revision>. Example: npm run check:task",
  });
  for (const flag of flags) {
    if (!["task", "diff", "committed", "full", "all", "plan"].includes(flag))
      throw new Error(`Unknown check option: --${flag}`);
  }
  return resolveSelectedPaths(ROOT, { flags, paths, revision });
}

function defaultRunner(label, command, args, env) {
  // Sanitize labels for log filenames: labels differ only by spaces today, but
  // slashes or other separators would collide or escape the check/ directory.
  const slug = label.replaceAll(/[^a-z0-9-_]+/giu, "-");
  return runCommandAsync(command, args, {
    cwd: ROOT,
    env,
    // Unit selections have their own test deadlines and may wait for the lane.
    timeout:
      env.ALCHEMY_CHECK_PROFILE === "local"
        ? args[0] === "scripts/verify-changed.mjs"
          ? undefined
          : 60_000
        : undefined,
    logPath: path.join(ROOT, "reports/runs", env.ALCHEMY_RUN_ID, "check", `${slug}.log`),
  });
}

export async function runCheck(argv = process.argv.slice(2), options = {}) {
  if (argv.every((arg) => ["--plan", "--full"].includes(arg))) argv = ["--task", ...argv];
  const runner = options.runner ?? defaultRunner;
  const paths = parseCheckArgs(argv);
  const full = argv.includes("--full");
  console.log(
    `Scope: ${full ? "broad completion gate: selected tests, full static validation and applicable builds" : "lightweight task gate: localization, documentation, selected-file formatting and lint; tests and compilation deferred to CI"}.`,
  );
  // Keep explicit directory selections unexpanded for the final membership scan.
  const raw = argv.includes("--pre-push") ? null : parseChangedPathsArgs(argv);
  if (raw?.revision) console.log(`Selection: files changed by ${raw.revision}; execution uses the current checkout.`);
  if (raw?.flags.has("task"))
    console.log(`Selection: task delta since shared main ancestor ${taskComparisonBase(ROOT)}, plus working paths.`);
  const guardedPaths = !full && raw ? (raw.paths.length ? raw.paths : paths) : undefined;
  let selectionStable = true;
  const digestFn =
    options.captureDigest ??
    (() => {
      if (raw?.flags.has("task")) {
        const currentPaths = resolveSelectedPaths(ROOT, raw);
        if (JSON.stringify(currentPaths) !== JSON.stringify(paths)) selectionStable = false;
      }
      return captureSourceDigest({ paths: guardedPaths });
    });
  if (paths.length === 0) {
    console.log("No changed source to check.");
    return 0;
  }
  const runId = ensureRunId("check");
  const env = {
    ...process.env,
    ALCHEMY_RUN_ID: runId,
    ALCHEMY_CHECK_PROFILE: full ? "full" : "local",
    ...(full
      ? {}
      : {
          RAYON_NUM_THREADS: "1",
        }),
  };
  // Hooks export repository-local Git settings. Verification also initializes
  // fixture repositories, which must never inherit the pushing checkout's paths.
  for (const name of gitOutput(["rev-parse", "--local-env-vars"]).trim().split(/\s+/u)) delete env[name];
  let verifyArgs = [...paths];
  // Byte budget for inline CLI args before spilling the selection to paths.json.
  // Distinct from the related-test arg limit in change-routes.mjs (see
  // lib/verification/selection-budgets.mjs: same value, different meaning).
  if (Buffer.byteLength(JSON.stringify(paths)) > INLINE_ARGS_BYTES) {
    const selectionFile = path.join(ROOT, "reports/runs", runId, "paths.json");
    fs.mkdirSync(path.dirname(selectionFile), { recursive: true });
    fs.writeFileSync(selectionFile, JSON.stringify(paths));
    verifyArgs = ["--paths-file", selectionFile];
  }
  // Static checks rerun docs:check via lint:ci, so verification skips its own
  // copy on executable changes; documentation-only changes keep it here.
  if (full) verifyArgs.push("--full");
  if (argv.includes("--all")) verifyArgs.push("--all-units");
  const plan = resolveCheckPlan(paths, {
    rootDir: ROOT,
    full,
    prePush: argv.includes("--pre-push"),
    skipBuilds: process.env.ALCHEMY_CHECK_SKIP_BUILD === "1",
    verifyArgs,
  });
  verifyArgs = plan.verifyArgs;
  const selection = plan.selection;
  const definitions = plan.steps;
  const steps = [];
  const artifacts = [];
  const exposures = [];
  let failed = null;

  if (argv.includes("--plan")) {
    for (const definition of definitions) {
      console.log(
        `${definition.enabled ? "Run" : "Skip"}: ${definition.label}${definition.enabled ? ` — ${definition.command} ${definition.args.join(" ")}` : ` — ${definition.reason ?? "not applicable"}`}`,
      );
    }
    const { main: verify } = await import("./verify-changed.mjs");
    return verify([...verifyArgs, "--plan"]);
  }
  if (full && !options.runner) assertHeavyLocalAllowed("Full completion gate");
  const before = digestFn();
  const cache =
    options.runner || !selection.needsCodeChecks
      ? null
      : createVerificationCache(
          ROOT,
          definitions.filter((step) => step.enabled),
        );
  const outcomes = [];
  console.log(`Check run: ${runId} (source ${before.hash}; guard: ${before.scope ?? "provided input identity"})`);
  for (const definition of definitions) {
    if (!definition.enabled) {
      steps.push({ label: definition.label, status: "skipped", durationMs: 0, reason: definition.reason });
      continue;
    }
    console.log(`\n== ${definition.label} ==`);
    const started = Date.now();
    const receipt = cache?.read(definition);
    const runnerResult = receipt ? 0 : await runner(definition.label, definition.command, definition.args, env);
    if (definition.key === "verification" && !options.runner) {
      // Intentional nesting: verify owns its run record and selection policy;
      // check links verify/summary.json so reuse provenance survives handoff.
      const verificationSummary = path.join(ROOT, "reports/runs", receipt?.runId ?? runId, "verify/summary.json");
      if (fs.existsSync(verificationSummary)) artifacts.push({ path: verificationSummary, role: "secondary" });
    }
    const durationMs = Date.now() - started;
    const result =
      typeof runnerResult === "number"
        ? { status: runnerResult, elapsedMs: durationMs, output: "" }
        : {
            ...runnerResult,
            status: runnerResult?.status ?? 1,
            elapsedMs: runnerResult?.elapsedMs ?? durationMs,
            output: String(runnerResult?.output ?? ""),
          };
    const code = result.status ?? 1;
    const status = code === 0 ? "passed" : "failed";
    steps.push({
      label: definition.label,
      status,
      durationMs,
      ...(receipt ? { reason: `Reused passing run ${receipt.runId}; inputs unchanged` } : {}),
    });
    outcomes.push({ command: definition, passed: code === 0, result, ...(receipt ? { reused: receipt.runId } : {}) });
    if (code !== 0) {
      const reportsDir = path.join(ROOT, "reports", "runs", runId, "check");
      const evidence = summarizeAndReportFailure(reportsDir, definition, result, runId, steps.length - 1, ROOT);
      exposures.push(evidence.exposure);
      artifacts.push({ path: evidence.digestPath, role: "primary" }, { path: evidence.logPath, role: "secondary" });
      failed = { label: definition.label, code, ...evidence };
      break;
    }
    const { exposure } = summarizeStepResult(definition, result);
    exposures.push(exposure);
    console.log(
      `✓ ${definition.label} (${receipt ? `reused passing run ${receipt.runId}; inputs unchanged` : `${(durationMs / 1000).toFixed(1)}s`})`,
    );
  }
  for (const definition of definitions.slice(steps.length)) {
    steps.push({ label: definition.label, status: "skipped", durationMs: 0, reason: "earlier step failed" });
  }

  const after = digestFn();
  const stable = cache?.finish(outcomes, runId) ?? true;
  if (!failed && (after.hash !== before.hash || !stable || !selectionStable)) {
    failed = { label: "source staleness", code: 1 };
    steps.push({
      label: "source staleness",
      status: "failed",
      durationMs: 0,
      reason: `${before.hash} -> ${after.hash}`,
    });
  }
  const passed = steps.filter((step) => step.status === "passed").length;
  const failedCount = steps.filter((step) => step.status === "failed").length;
  const skipped = steps.filter((step) => step.status === "skipped").length;
  writeCurrentRun({
    rootDir: ROOT,
    runId,
    status: failed ? "failed" : "passed",
    command: full ? "npm run check -- --full" : "npm run check",
    artifacts,
    counts: { passed, failed: failedCount, skipped },
    commandExposures: exposures,
    steps,
    sourceDigest: before.hash,
    summary: failed
      ? `Check failed at ${failed.label}.`
      : full
        ? `${passed} steps passed; ${skipped} not applicable.`
        : "Local verification complete; CI and platform acceptance are separate.",
  });
  if (failed) {
    console.error(`✗ check failed at ${failed.label} (exit ${failed.code}, run ${runId})`);
    return 1;
  }
  console.log(
    `\n✓ ${full ? "full check passed" : "local verification complete; CI and platform acceptance are separate"} (run ${runId}, source ${before.hash})`,
  );
  return 0;
}

if (isMainModule(import.meta.url)) {
  const planOnly = process.argv.includes("--plan");
  (planOnly ? Promise.resolve() : registerArtifactSession(ROOT, () => pruneExpiredArtifacts({ rootDir: ROOT })))
    .then(() => runCheck())
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    });
}
