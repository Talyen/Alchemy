import { commitManifest, processManifestEntries } from "./asset-manifest-cache.mjs";
import { failedOptimizeResult, targetErrorHandler } from "./process-helpers.mjs";

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
 *   keyOf?: (entry: never) => string,
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
  manifestBasename = "",
  label = "asset",
  concurrency = 1,
  keyOf,
  processEntry,
  check = false,
  skipLabel,
  commit = true,
}) {
  const { previousManifest, nextManifest, results, failed } = await processManifestEntries({
    entries,
    manifestPath,
    concurrency,
    ...(keyOf ? { keyOf } : {}),
    processEntry,
    handleError: targetErrorHandler,
  });

  if (failed) {
    return { ...failedOptimizeResult(results, skipLabel), previousManifest, nextManifest, results };
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
