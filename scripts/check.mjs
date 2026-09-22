#!/usr/bin/env node
/** Source-aware local completion gate with one complete run record. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { changedGitPaths, ensureRunId, writeCurrentRun } from "./lib/verification/current-run.mjs";
import { summarizeAndReportFailure, summarizeStepResult } from "./lib/run-step.mjs";
import {
  classifyCheckPaths,
  parseChangedPathsArgs,
  resolveSelectedPaths,
  resolvePushPaths,
} from "./lib/verification/changed-paths.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { runGit } from "./lib/repository-paths.mjs";
import { runCommand } from "./lib/run-command.mjs";
import { INLINE_ARGS_BYTES } from "./lib/agent/selection-budgets.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function gitOutput(args) {
  const result = runGit(ROOT, args);
  return result.status === 0 ? result.stdout : "";
}

function hashPath(relativePath) {
  try {
    const stats = fs.lstatSync(path.join(ROOT, relativePath));
    if (stats.isSymbolicLink()) return `symlink:${fs.readlinkSync(path.join(ROOT, relativePath))}`;
    if (!stats.isFile()) return `other:${stats.mode.toString(8)}`;
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(ROOT, relativePath)))
      .digest("hex");
  } catch {
    return "missing";
  }
}

export function captureSourceDigest() {
  const head = gitOutput(["rev-parse", "HEAD"]).trim() || "no-head";
  const paths = changedGitPaths(ROOT) ?? [];
  const payload = [head, ...paths.sort().map((filePath) => `${filePath}:${hashPath(filePath)}`)].join("\0");
  return { head, hash: crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16) };
}

export function parseCheckArgs(argv) {
  if (argv.includes("--pre-push")) {
    if (argv.length !== 1) throw new Error("--pre-push cannot be combined with other selections");
    if (process.stdin.isTTY) throw new Error("--pre-push requires Git hook input on stdin");
    return resolvePushPaths(ROOT, fs.readFileSync(0, "utf8"));
  }
  const { flags, paths } = parseChangedPathsArgs(argv, {
    usage: "Provide paths or use --diff. Example: npm run check -- --diff",
  });
  for (const flag of flags) {
    if (flag !== "diff") throw new Error(`Unknown check option: --${flag}`);
  }
  return resolveSelectedPaths(ROOT, { flags, paths });
}

function classify(paths) {
  const { needsCodeChecks, lockfile, desktop, web } = classifyCheckPaths(ROOT, paths);
  return { needsCodeChecks, lockfile, desktop, web };
}

function defaultRunner(label, command, args, env) {
  // Sanitize labels for log filenames: labels differ only by spaces today, but
  // slashes or other separators would collide or escape the check/ directory.
  const slug = label.replaceAll(/[^a-z0-9-_]+/giu, "-");
  return runCommand(command, args, {
    cwd: ROOT,
    env,
    logPath: path.join(ROOT, "reports/runs", env.ALCHEMY_RUN_ID, "check", `${slug}.log`),
  });
}

export async function runCheck(argv = process.argv.slice(2), options = {}) {
  const runner = options.runner ?? defaultRunner;
  const digestFn = options.captureDigest ?? captureSourceDigest;
  const paths = parseCheckArgs(argv);
  if (paths.length === 0) {
    console.log("No changed source to check.");
    return 0;
  }
  const selection = classify(paths);
  const runId = ensureRunId("check");
  const env = { ...process.env, ALCHEMY_RUN_ID: runId };
  const before = digestFn();
  let verifyArgs = [...paths];
  // Byte budget for inline CLI args before spilling the selection to paths.json.
  // Distinct from the related-test arg limit in change-routes.mjs (see
  // lib/agent/selection-budgets.mjs: same value, different meaning).
  if (Buffer.byteLength(JSON.stringify(paths)) > INLINE_ARGS_BYTES) {
    const selectionFile = path.join(ROOT, "reports/runs", runId, "paths.json");
    fs.mkdirSync(path.dirname(selectionFile), { recursive: true });
    fs.writeFileSync(selectionFile, JSON.stringify(paths));
    verifyArgs = ["--paths-file", selectionFile];
  }
  // Static checks rerun docs:check via lint:ci, so verification skips its own
  // copy on executable changes; documentation-only changes keep it here.
  if (selection.needsCodeChecks) verifyArgs.push("--skip-docs-check");
  const skipBuilds = process.env.ALCHEMY_CHECK_SKIP_BUILD === "1";
  const buildReason = skipBuilds ? "skipped via ALCHEMY_CHECK_SKIP_BUILD=1 (CI still builds)" : undefined;
  const webEnabled = selection.web && !skipBuilds;
  const desktopEnabled = selection.desktop && !skipBuilds;
  const definitions = [
    {
      key: "verification",
      label: "changed-path verification",
      command: "node",
      args: ["scripts/verify-changed.mjs", ...verifyArgs],
      enabled: true,
    },
    {
      key: "documentation-format",
      label: "documentation format",
      command: "npm",
      args: ["run", "format:check"],
      enabled: !selection.needsCodeChecks,
      reason: "included in static checks",
    },
    {
      key: "ci-static",
      label: "CI static checks",
      command: "npm",
      args: ["run", "lint:ci"],
      enabled: selection.needsCodeChecks,
      reason: "documentation-only change",
    },
    {
      key: "lockfile",
      label: "lockfile consistency",
      command: "npm",
      args: ["ci", "--dry-run", "--ignore-scripts"],
      enabled: selection.lockfile,
      reason: "package manifests unchanged",
    },
    {
      key: "web-build",
      label: "web build",
      command: "npm",
      args: ["run", "build"],
      enabled: webEnabled,
      reason: buildReason ?? "web runtime inputs unchanged",
    },
    {
      key: "web-bundle-budget",
      label: "web bundle budget",
      command: "npm",
      // Web and desktop renderer builds both write dist/ sequentially: each
      // budget step checks dist/ immediately after its own build, so the same
      // check:bundle command validates different outputs at different times.
      args: ["run", "check:bundle"],
      enabled: webEnabled,
      reason: buildReason ?? "web build not required",
    },
    {
      key: "preview-smoke",
      label: "preview smoke",
      command: "npm",
      args: ["run", "smoke:preview"],
      enabled: webEnabled,
      reason: buildReason ?? "web build not required",
    },
    {
      key: "desktop-build",
      label: "desktop build",
      command: "npm",
      args: ["run", "build:desktop"],
      enabled: desktopEnabled,
      reason: buildReason ?? "desktop inputs unchanged",
    },
    {
      key: "desktop-bundle-budget",
      label: "desktop bundle budget",
      command: "npm",
      // Same dist/ path as web by design: runs after desktop-build, so it
      // validates the desktop renderer output that just overwrote dist/.
      args: ["run", "check:bundle"],
      enabled: desktopEnabled,
      reason: buildReason ?? "desktop build not required",
    },
  ];
  const steps = [];
  const artifacts = [];
  const exposures = [];
  let failed = null;

  console.log(`Check run: ${runId} (source ${before.hash})`);
  for (const definition of definitions) {
    if (!definition.enabled) {
      steps.push({ label: definition.label, status: "skipped", durationMs: 0, reason: definition.reason });
      continue;
    }
    console.log(`\n== ${definition.label} ==`);
    const started = Date.now();
    const runnerResult = await runner(definition.label, definition.command, definition.args, env);
    if (definition.key === "verification" && !options.runner) {
      // Intentional nesting: verify owns its run record and selection policy;
      // check links verify/summary.json so reuse provenance survives handoff.
      const verificationSummary = path.join(ROOT, "reports/runs", runId, "verify/summary.json");
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
    steps.push({ label: definition.label, status, durationMs });
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
    console.log(`✓ ${definition.label} (${(durationMs / 1000).toFixed(1)}s)`);
  }
  for (const definition of definitions.slice(steps.length)) {
    steps.push({ label: definition.label, status: "skipped", durationMs: 0, reason: "earlier step failed" });
  }

  const after = digestFn();
  if (!failed && after.hash !== before.hash) {
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
    command: "npm run check",
    artifacts,
    counts: { passed, failed: failedCount, skipped },
    commandExposures: exposures,
    steps,
    sourceDigest: before.hash,
    summary: failed ? `Check failed at ${failed.label}.` : `${passed} steps passed; ${skipped} not applicable.`,
  });
  if (failed) {
    console.error(`✗ check failed at ${failed.label} (exit ${failed.code}, run ${runId})`);
    return 1;
  }
  console.log(`\n✓ check passed (run ${runId}, source ${before.hash})`);
  return 0;
}

if (isMainModule(import.meta.url)) {
  runCheck()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    });
}
