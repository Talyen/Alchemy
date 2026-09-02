#!/usr/bin/env node
/** Source-aware local completion gate with one complete run record. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { changedGitPaths, ensureRunId, writeCurrentRun } from "./lib/current-run.mjs";
import { classifyCheckPaths, parseChangedPathsArgs, resolveSelectedPaths } from "./lib/changed-paths.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function gitOutput(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
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
  const { flags, paths } = parseChangedPathsArgs(argv, {
    usage: "Provide paths or use --diff. Example: npm run check -- --diff",
  });
  for (const flag of flags) {
    if (flag !== "diff") throw new Error(`Unknown check option: --${flag}`);
  }
  return resolveSelectedPaths(ROOT, { flags, paths });
}

function classify(paths) {
  const { executable, lockfile, desktop, web } = classifyCheckPaths(paths);
  return { executable, lockfile, desktop, web };
}

function defaultRunner(_label, command, args, env) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

function stepDefinition(label, command, args, enabled, reason) {
  return { label, command, args, enabled, reason };
}

export async function runCheck(argv = process.argv.slice(2), options = {}) {
  const runner = options.runner ?? defaultRunner;
  const digestFn = options.captureDigest ?? captureSourceDigest;
  const paths = parseCheckArgs(argv);
  const selection = classify(paths);
  const runId = ensureRunId("check");
  const env = { ...process.env, ALCHEMY_RUN_ID: runId };
  const before = digestFn();
  const verifyArgs = paths.length > 0 ? paths : ["--diff"];
  const definitions = [
    stepDefinition("changed-path verification", "node", ["scripts/verify-changed.mjs", ...verifyArgs], true),
    stepDefinition(
      "documentation format",
      "npm",
      ["run", "format:check"],
      !selection.executable,
      "included in static checks",
    ),
    stepDefinition("static checks", "npm", ["run", "check:static"], selection.executable, "documentation-only change"),
    stepDefinition(
      "lockfile consistency",
      "npm",
      ["ci", "--dry-run", "--ignore-scripts"],
      selection.lockfile,
      "package manifests unchanged",
    ),
    stepDefinition("web build", "npm", ["run", "build"], selection.web, "web runtime inputs unchanged"),
    stepDefinition("preview smoke", "npm", ["run", "smoke:preview"], selection.web, "web build not required"),
    stepDefinition("desktop build", "npm", ["run", "build:desktop"], selection.desktop, "desktop inputs unchanged"),
  ];
  const steps = [];
  let failed = null;

  console.log(`Check run: ${runId} (source ${before.hash})`);
  for (const definition of definitions) {
    if (!definition.enabled) {
      steps.push({ label: definition.label, status: "skipped", durationMs: 0, reason: definition.reason });
      continue;
    }
    console.log(`\n== ${definition.label} ==`);
    const started = Date.now();
    const result = runner(definition.label, definition.command, definition.args, env);
    const code = result instanceof Promise ? await result : result;
    const durationMs = Date.now() - started;
    const status = code === 0 ? "passed" : "failed";
    steps.push({ label: definition.label, status, durationMs });
    if (code !== 0) {
      failed = { label: definition.label, code };
      break;
    }
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
    counts: { passed, failed: failedCount, skipped },
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
