#!/usr/bin/env node
/** Source-aware local completion gate with one complete run record. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { changedGitPaths, ensureRunId, writeCurrentRun } from "./lib/verification/current-run.mjs";
import { summarizeAndReportFailure, summarizeStepResult } from "./lib/run-step.mjs";
import {
  classifyCheckPaths,
  parseChangedPathsArgs,
  resolveSelectedPaths,
  resolvePushPaths,
} from "./lib/verification/changed-paths.mjs";
import { registerArtifactSession } from "./lib/artifact-guard.mjs";
import { pruneExpiredArtifacts } from "./prune-transient-artifacts.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { runGit } from "./lib/repository-paths.mjs";
import { runCommandAsync } from "./lib/run-command.mjs";
import { closeTaskBrowsers, taskKey } from "./lib/agent-browser-session.mjs";
import { INLINE_ARGS_BYTES } from "./lib/agent/selection-budgets.mjs";
import { filterPrettierPaths } from "./prettier-paths.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function gitOutput(args) {
  const result = runGit(ROOT, args);
  if (result.status !== 0)
    throw new Error(`Could not capture source revision: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
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
  } catch (error) {
    if (error.code === "ENOENT") return "missing";
    throw error;
  }
}

export function captureSourceDigest() {
  const head = gitOutput(["rev-parse", "HEAD"]).trim();
  const paths = changedGitPaths(ROOT);
  if (!head || paths === null) throw new Error("Could not capture source state: git status or HEAD is unavailable");
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
    if (flag !== "diff" && flag !== "full") throw new Error(`Unknown check option: --${flag}`);
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
  return runCommandAsync(command, args, {
    cwd: ROOT,
    env,
    timeout: env.ALCHEMY_CHECK_PROFILE === "local" ? 30_000 : undefined,
    logPath: path.join(ROOT, "reports/runs", env.ALCHEMY_RUN_ID, "check", `${slug}.log`),
  });
}

export async function runCheck(argv = process.argv.slice(2), options = {}) {
  const runner = options.runner ?? defaultRunner;
  const digestFn = options.captureDigest ?? captureSourceDigest;
  const paths = parseCheckArgs(argv);
  const full = argv.includes("--full");
  if (paths.length === 0) {
    console.log("No changed source to check.");
    return 0;
  }
  const selection = classify(paths);
  const runId = ensureRunId("check");
  const env = {
    ...process.env,
    ALCHEMY_RUN_ID: runId,
    ALCHEMY_CHECK_PROFILE: full ? "full" : "local",
    ...(full
      ? {}
      : {
          NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=512`.trim(),
          RAYON_NUM_THREADS: "1",
        }),
  };
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
  if (full) verifyArgs.push("--full");
  if (full && selection.needsCodeChecks) verifyArgs.push("--skip-docs-check");
  const skipBuilds = !full || process.env.ALCHEMY_CHECK_SKIP_BUILD === "1";
  const ciReason = "CI-only in the default local gate";
  const buildReason = !full
    ? ciReason
    : skipBuilds
      ? "skipped via ALCHEMY_CHECK_SKIP_BUILD=1 (CI still builds)"
      : undefined;
  const webEnabled = selection.web && !skipBuilds;
  const desktopEnabled = selection.desktop && !skipBuilds;
  const formatPaths = filterPrettierPaths(paths).filter((file) =>
    fs.statSync(path.join(ROOT, file), { throwIfNoEntry: false })?.isFile(),
  );
  const smallFormatBatch =
    formatPaths.length > 0 &&
    formatPaths.length <= 50 &&
    formatPaths.every((file) => fs.statSync(path.join(ROOT, file)).size <= 256_000);
  const definitions = [
    {
      key: "verification",
      label: "changed-path verification",
      command: "node",
      args: ["scripts/verify-changed.mjs", ...verifyArgs],
      enabled: true,
    },
    {
      key: "local-format",
      label: "selected-file format",
      command: "node",
      args: ["scripts/run-prettier.mjs", "--check", ...formatPaths],
      enabled: !full && smallFormatBatch,
      reason: full ? "included in full static checks" : "empty or large formatting batch deferred to CI",
    },
    {
      key: "documentation-format",
      label: "documentation format",
      command: "npm",
      args: ["run", "format:check"],
      enabled: full && !selection.needsCodeChecks,
      reason: !full ? ciReason : "included in static checks",
    },
    {
      key: "ci-static",
      label: "CI static checks",
      command: "npm",
      args: ["run", "lint:ci"],
      enabled: full && selection.needsCodeChecks,
      reason: !full ? ciReason : "documentation-only change",
    },
    {
      key: "lockfile",
      label: "lockfile consistency",
      command: "npm",
      args: ["ci", "--dry-run", "--ignore-scripts"],
      enabled: full && selection.lockfile,
      reason: !full ? ciReason : "package manifests unchanged",
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
        : "Local check passed; full CI validation is required.",
  });
  if (failed) {
    console.error(`✗ check failed at ${failed.label} (exit ${failed.code}, run ${runId})`);
    return 1;
  }
  console.log(
    `\n✓ ${full ? "full check passed" : "local check passed; full validation required in CI"} (run ${runId}, source ${before.hash})`,
  );
  return 0;
}

if (isMainModule(import.meta.url)) {
  let cleanupFinished = false;
  process.once("exit", () => {
    if (cleanupFinished || !taskKey() || process.platform === "win32") return;
    // Cancellation can exit from the command runner before promises settle.
    // Finish cleanup here and expose a failure instead of abandoning a silent child.
    const cleanup = spawnSync(process.execPath, [path.join(ROOT, "scripts/agent-browser.mjs"), "--cleanup-task"], {
      stdio: "inherit",
      timeout: 30_000,
    });
    if (cleanup.status !== 0) {
      console.error("Browser cleanup failed; retained ownership records for recovery.");
      process.exitCode = 2;
    }
  });
  registerArtifactSession(ROOT, () => pruneExpiredArtifacts({ rootDir: ROOT }))
    .then(() => runCheck())
    .then(async (code) => {
      await closeTaskBrowsers();
      cleanupFinished = true;
      process.exitCode = code;
    })
    .catch(async (error) => {
      await closeTaskBrowsers().catch((cleanupError) => console.error(cleanupError.message));
      cleanupFinished = true;
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    });
}
