#!/usr/bin/env node
/** Remove stale local test, diagnostic, and report artifacts without touching source. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TRANSIENT_ARTIFACT_DIRS, formatBytes, removePath } from "./lib/clean-dev-artifacts.mjs";
import { withArtifactGuard } from "./lib/artifact-guard.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TRANSIENT_DIRS = TRANSIENT_ARTIFACT_DIRS;
const DEFAULT_DAYS = 1;

function parseDays(value) {
  const days = Number(value);
  if (!value.trim() || !Number.isFinite(days) || days < 0) throw new Error("--days must be a non-negative number");
  return days;
}

export function parsePruneArgs(argv) {
  let days = DEFAULT_DAYS;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--days=")) days = parseDays(arg.slice("--days=".length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return { days, dryRun };
}

// These directories contain independent runs; other report directories are a
// single bundle so an old source/capture cannot disappear from a fresh result.
const RUN_COLLECTIONS = new Set([
  "reports/runs",
  "reports/compact",
  "reports/agent-diff",
  "reports/agent-evals",
  "reports/performance",
  "test-results/failures",
]);

function bundleInfo(pathname) {
  const stats = fs.lstatSync(pathname);
  let bytes = stats.size;
  let newest = stats.mtimeMs;
  if (stats.isDirectory() && !stats.isSymbolicLink()) {
    bytes = 0;
    for (const name of fs.readdirSync(pathname)) {
      const child = bundleInfo(path.join(pathname, name));
      bytes += child.bytes;
      newest = Math.max(newest, child.newest);
    }
  }
  return { bytes, newest };
}

/** Internal synchronous pruning; callers serialize it with the artifact guard. */
export function pruneExpiredArtifacts({
  days = DEFAULT_DAYS,
  dryRun = false,
  now = Date.now(),
  rootDir = ROOT,
  transientDirs = TRANSIENT_DIRS,
} = {}) {
  if (!Number.isFinite(days) || days < 0) throw new Error("days must be non-negative");
  const cutoff = now - days * 86_400_000;
  const removed = [];
  const consider = (pathname) => {
    const info = bundleInfo(pathname);
    if (info.newest < cutoff) {
      removed.push({ path: path.relative(rootDir, pathname), bytes: info.bytes });
      if (!dryRun) removePath(pathname);
    }
  };
  for (const relative of transientDirs) {
    const target = path.join(rootDir, relative);
    const stats = fs.lstatSync(target, { throwIfNoEntry: false });
    if (!stats?.isDirectory() || stats.isSymbolicLink()) continue;
    for (const name of fs.readdirSync(target)) {
      const child = path.join(target, name);
      const relativeChild = path.relative(rootDir, child).replaceAll(path.sep, "/");
      if (/^reports\/current-run\.(?:json|md)$/u.test(relativeChild)) continue;
      const childStats = fs.lstatSync(child);
      if (RUN_COLLECTIONS.has(relativeChild) && childStats.isDirectory() && !childStats.isSymbolicLink()) {
        for (const run of fs.readdirSync(child)) consider(path.join(child, run));
      } else consider(child);
    }
  }
  const reportsStats = fs.lstatSync(path.join(rootDir, "reports"), { throwIfNoEntry: false });
  if (!transientDirs.includes("reports") || !reportsStats?.isDirectory() || reportsStats.isSymbolicLink())
    return { removed, bytes: removed.reduce((sum, entry) => sum + entry.bytes, 0), skippedActive: false };
  const pointer = path.join(rootDir, "reports/current-run.json");
  if (fs.lstatSync(pointer, { throwIfNoEntry: false })?.isFile()) {
    let run;
    try {
      run = JSON.parse(fs.readFileSync(pointer, "utf8")).runId;
    } catch {
      /* Expire malformed pointers normally. */
    }
    const valid = typeof run === "string" && /^[a-z0-9-]+$/u.test(run);
    const runRelative = valid ? `reports/runs/${run}` : null;
    const expired =
      runRelative &&
      (removed.some((entry) => entry.path.replaceAll(path.sep, "/") === runRelative) ||
        !fs.existsSync(path.join(rootDir, runRelative, "run.json")));
    for (const name of ["current-run.json", "current-run.md"]) {
      const file = path.join(rootDir, "reports", name);
      if (!fs.lstatSync(file, { throwIfNoEntry: false })) continue;
      if (expired) {
        removed.push({ path: path.relative(rootDir, file), bytes: fs.lstatSync(file).size });
        if (!dryRun) removePath(file);
      } else if (!valid) consider(file);
    }
  } else {
    if (fs.lstatSync(pointer, { throwIfNoEntry: false })) consider(pointer);
    const markdown = path.join(rootDir, "reports/current-run.md");
    if (fs.lstatSync(markdown, { throwIfNoEntry: false })) consider(markdown);
  }
  return { removed, bytes: removed.reduce((sum, entry) => sum + entry.bytes, 0), skippedActive: false };
}

export async function pruneTransientArtifacts(options = {}) {
  return withArtifactGuard(
    options.rootDir ?? ROOT,
    ({ active }) => (active ? { removed: [], bytes: 0, skippedActive: true } : pruneExpiredArtifacts(options)),
    { dryRun: options.dryRun },
  );
}

async function main(argv = process.argv.slice(2)) {
  try {
    const options = parsePruneArgs(argv);
    const result = await pruneTransientArtifacts(options);
    if (result.skippedActive) {
      console.log("Artifact tool is active; pruning skipped.");
      return 0;
    }
    if (result.removed.length === 0) {
      console.log(`No transient artifacts older than ${options.days} day${options.days === 1 ? "" : "s"}.`);
      return 0;
    }
    const verb = options.dryRun ? "Would remove" : "Removed";
    for (const entry of result.removed.slice(0, 20)) console.log(`${verb} ${entry.path} (${formatBytes(entry.bytes)})`);
    if (result.removed.length > 20) console.log(`${verb} ${result.removed.length - 20} additional entries.`);
    console.log(`${verb} about ${formatBytes(result.bytes)} of transient artifacts.`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (isMainModule(import.meta.url))
  main().then((code) => {
    process.exitCode = code;
  });
