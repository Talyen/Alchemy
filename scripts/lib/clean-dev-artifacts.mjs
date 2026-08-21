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

/** Always-safe report / cache dirs relative to the project root. */
export const DEFAULT_ARTIFACT_DIRS = Object.freeze([...TRANSIENT_ARTIFACT_DIRS, "node_modules/.vite"]);

/** Heavier rebuildable outputs; only removed with `--builds` / `--all`. */
export const BUILD_ARTIFACT_DIRS = Object.freeze(["dist", "release-desktop"]);

/** E2E / Electron preview ports that should not linger after crashed test runs. */
export const STALE_TEST_PORTS = Object.freeze([4173, 4175, 4176]);

/**
 * @param {string} rootDir
 * @param {{ builds?: boolean }} [options]
 * @returns {string[]} Absolute paths that currently exist and should be removed.
 */
export function listArtifactDirsToRemove(rootDir, options = {}) {
  const relativeDirs = options.builds ? [...DEFAULT_ARTIFACT_DIRS, ...BUILD_ARTIFACT_DIRS] : [...DEFAULT_ARTIFACT_DIRS];

  return relativeDirs.map((relative) => path.join(rootDir, relative)).filter((absolute) => fs.existsSync(absolute));
}

/**
 * @param {string} absolutePath
 * @returns {{ path: string, bytes: number }}
 */
export function measurePath(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return { path: absolutePath, bytes: 0 };
  }

  const stats = fs.lstatSync(absolutePath);
  if (stats.isFile() || stats.isSymbolicLink()) {
    return { path: absolutePath, bytes: stats.size };
  }

  let bytes = 0;
  const stack = [absolutePath];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const child = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          stack.push(child);
        } else if (entry.isFile()) {
          bytes += fs.statSync(child).size;
        }
      } catch {
        // Race with concurrent writers; skip unreadable entries.
      }
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
