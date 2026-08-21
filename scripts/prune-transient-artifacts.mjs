#!/usr/bin/env node
/** Remove stale local test, diagnostic, and report artifacts without touching source. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TRANSIENT_ARTIFACT_DIRS, formatBytes, measurePath } from "./lib/clean-dev-artifacts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TRANSIENT_DIRS = TRANSIENT_ARTIFACT_DIRS;
const DEFAULT_DAYS = 1;

function parseDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days) || days < 0) throw new Error("--days must be a non-negative number");
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

function stale(pathname, cutoff) {
  try {
    return fs.lstatSync(pathname).mtimeMs < cutoff;
  } catch {
    return false;
  }
}

function pruneDirectory(pathname, cutoff, dryRun, removed, rootDir) {
  let entries;
  try {
    entries = fs.readdirSync(pathname, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const child = path.join(pathname, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      pruneDirectory(child, cutoff, dryRun, removed, rootDir);
      let isEmpty;
      try {
        isEmpty = fs.readdirSync(child).length === 0;
      } catch {
        continue;
      }
      // Empty directories contain no evidence, so remove them regardless of
      // mtime; the transient root itself is never passed through this branch.
      if (isEmpty) {
        const bytes = measurePath(child).bytes;
        removed.push({ path: path.relative(rootDir, child), bytes });
        if (!dryRun) fs.rmSync(child, { recursive: true, force: true });
      }
    } else if (stale(child, cutoff)) {
      const bytes = measurePath(child).bytes;
      removed.push({ path: path.relative(rootDir, child), bytes });
      if (!dryRun) fs.rmSync(child, { force: true });
    }
  }
}

export function pruneTransientArtifacts({
  days = DEFAULT_DAYS,
  dryRun = false,
  now = Date.now(),
  rootDir = ROOT,
  transientDirs = TRANSIENT_DIRS,
} = {}) {
  const cutoff = now - days * 86_400_000;
  const removed = [];
  for (const relative of transientDirs) {
    const target = path.join(rootDir, relative);
    if (fs.existsSync(target)) pruneDirectory(target, cutoff, dryRun, removed, rootDir);
  }
  return { removed, bytes: removed.reduce((sum, entry) => sum + entry.bytes, 0) };
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parsePruneArgs(argv);
    const result = pruneTransientArtifacts(options);
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
