// Resolves which local Alchemy build/test artifacts are safe to delete.
// Depends only on path layout under a project root; process stopping stays in the CLI.
import fs from "node:fs";
import path from "node:path";

/** Report/diagnostic directories shared by age-pruning and explicit cleanup. */
export const TRANSIENT_ARTIFACT_DIRS = Object.freeze([
  "playwright-report",
  "test-results",
  "blob-report",
  "coverage",
  "reports",
]);

/** Rebuildable caches; linked dependency ancestors are never traversed. */
export const DEFAULT_ARTIFACT_DIRS = Object.freeze(["node_modules/.vite", "scripts/trailers/node_modules/.cache"]);

/** Opt-in environments and model caches, separate from retained evidence. */
const TOOL_CACHE_DIRS = Object.freeze([".cache"]);

/** Heavier rebuildable outputs; only removed with `--builds` / `--all`. */
export const BUILD_ARTIFACT_DIRS = Object.freeze(["dist", "dist-demo", "release-desktop", "release-desktop-demo"]);

/**
 * @param {string} rootDir
 * @param {{ builds?: boolean, reports?: boolean, caches?: boolean }} [options]
 * @returns {string[]} Absolute paths that currently exist and should be removed.
 */
export function listArtifactDirsToRemove(rootDir, options = {}) {
  const relativeDirs = [
    ...DEFAULT_ARTIFACT_DIRS,
    ...(options.caches ? TOOL_CACHE_DIRS : []),
    ...(options.reports ? TRANSIENT_ARTIFACT_DIRS : []),
    ...(options.builds ? BUILD_ARTIFACT_DIRS : []),
  ];

  return relativeDirs.flatMap((relative) => {
    const segments = relative.split("/");
    // Worktrees link node_modules to the original checkout. Never descend
    // through that link to delete another checkout's cache; removing a target
    // that is itself a symlink remains safe because rm unlinks it.
    for (let index = 1; index < segments.length; index++) {
      const parent = fs.lstatSync(path.join(rootDir, ...segments.slice(0, index)), { throwIfNoEntry: false });
      if (!parent?.isDirectory() || parent.isSymbolicLink()) return [];
    }
    const absolute = path.join(rootDir, relative);
    return fs.lstatSync(absolute, { throwIfNoEntry: false }) ? [absolute] : [];
  });
}

/**
 * @param {string} absolutePath
 * @returns {{ path: string, bytes: number }}
 */
export function measurePath(absolutePath) {
  let bytes = 0;
  const pending = [absolutePath];
  while (pending.length > 0) {
    const current = pending.pop();
    try {
      // lstat never follows links into source archives or back into this tree.
      const stats = fs.lstatSync(current, { throwIfNoEntry: false });
      if (!stats) continue;
      if (stats.isFile() || stats.isSymbolicLink()) bytes += stats.size;
      else if (stats.isDirectory()) {
        for (const name of fs.readdirSync(current)) pending.push(path.join(current, name));
      }
    } catch {
      // Reports and caches can disappear or become unreadable during measurement.
    }
  }
  return { path: absolutePath, bytes };
}

/**
 * @param {string} absolutePath
 */
export function removePath(absolutePath) {
  fs.rmSync(absolutePath, { recursive: true, force: true });
}

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded}${units[unitIndex]}`;
}
