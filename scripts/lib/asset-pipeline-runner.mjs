import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { commitManifest, processManifestEntries } from "./asset-manifest-cache.mjs";
import { MANAGED_DIRS, MANIFEST_BASENAME } from "./asset-constants.mjs";
import { failedResult, targetErrorHandler } from "./process-helpers.mjs";

/**
 * Repository root for a script module URL. Lives here (not in the sync
 * helpers) so optimize pipelines don't pull in the static art manifest graph
 * just to locate their own directories.
 */
export function resolveRootDir(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..");
}

/** Manifest path for a managed output directory (`art` | `sounds` | `music`). */
export function getManagedManifestPath(rootDir, managedKey) {
  return path.join(rootDir, MANAGED_DIRS[managedKey].dir, MANIFEST_BASENAME);
}

/**
 * Shared directory layout for the art/sound/music optimizers: authoring
 * sources, managed outputs, and the hash manifest that tracks them.
 */
export function resolvePipelinePaths(importMetaUrl, { sourceSubpath, managedKey }) {
  const rootDir = resolveRootDir(importMetaUrl);
  return {
    rootDir,
    sourceDir: path.join(rootDir, ...sourceSubpath),
    outputDir: path.join(rootDir, MANAGED_DIRS[managedKey].dir),
    manifestPath: getManagedManifestPath(rootDir, managedKey),
  };
}

/** Create the output directory for mutating runs; check mode never writes. */
export async function ensureOutputDir(outputDir, { check = false } = {}) {
  if (!check) await mkdir(outputDir, { recursive: true });
}

/**
 * Read a source directory, wrapping a missing checkout with its context while
 * preserving the original `code`/`path` so freshness tests can match on them.
 * Other filesystem errors propagate untouched.
 */
export async function readSourceDir(
  dir,
  context = "This checkout may exclude raw sources; asset prep requires the full Raw Assets/ tree.",
) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      const wrapped = new Error(`Missing Raw Assets source "${dir}". ${context}`, { cause: error });
      wrapped.code = error.code;
      wrapped.path = error.path ?? dir;
      throw wrapped;
    }
    throw error;
  }
}

/**
 * Single runner for manifest-backed asset pipelines (art, music, and the OGG
 * phase of sounds). Callers own discovery plus per-entry transformation; this
 * runner owns freshness state, bounded concurrency, failure normalization,
 * manifest publication, and orphan sweeps so the three optimizers share one
 * shape.
 *
 * @param {{
 *   entries: unknown[],
 *   manifestPath: string,
 *   outputDir: string,
 *   manifestBasename?: string,
 *   label?: string,
 *   concurrency?: number,
 *   processEntry: (entry: never, storedEntry: import("./asset-manifest-cache.mjs").ManifestEntry | undefined) => Promise<{ message?: string, entry?: import("./asset-manifest-cache.mjs").ManifestEntry | null }>,
 *   check?: boolean,
 *   skipLabel: string,
 *   commit?: boolean,
 * }} options
 * Set commit:false when the caller publishes a wider manifest itself (sounds
 * merges OGG, curated, and MP3 entries before publishing).
 * @returns {Promise<{ ok: boolean, error?: string, previousManifest?: Record<string, import("./asset-manifest-cache.mjs").ManifestEntry>, nextManifest?: Record<string, import("./asset-manifest-cache.mjs").ManifestEntry>, results?: unknown[] }>}
 */
export async function runManifestPipeline({
  entries,
  manifestPath,
  outputDir,
  manifestBasename = MANIFEST_BASENAME,
  label = "asset",
  concurrency = 1,
  processEntry,
  check = false,
  skipLabel,
  commit = true,
}) {
  const { previousManifest, nextManifest, results, failed } = await processManifestEntries({
    entries,
    manifestPath,
    concurrency,
    processEntry,
    handleError: targetErrorHandler,
  });

  if (failed) {
    return { ...failedResult(results, skipLabel), previousManifest, nextManifest, results };
  }

  if (commit) {
    await commitManifest(manifestPath, nextManifest, {
      outputDir,
      check,
      manifestBasename,
      label,
    });
  }

  return { ok: true, previousManifest, nextManifest, results };
}
