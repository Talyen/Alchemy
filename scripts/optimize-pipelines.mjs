/**
 * Table-driven registry for the three asset optimize pipelines.
 * Each pipeline is independent (disjoint output dirs) but shares manifest
 * hashing / concurrency patterns via `lib/asset-manifest-cache.mjs`.
 * `prepare-assets.mjs` runs them concurrently; this module documents the table
 * so future pipelines (e.g., video) plug in without new glue code.
 */
export const OPTIMIZE_PIPELINES = {
  art: {
    label: "Art",
    module: "./optimize-assets.mjs",
    entry: "optimizeAssets",
  },
  sound: {
    label: "Sound",
    module: "./optimize-sounds.mjs",
    entry: "optimizeSounds",
  },
  music: {
    label: "Music",
    module: "./optimize-music.mjs",
    entry: "optimizeMusic",
  },
};

export async function runAllOptimizePipelines() {
  const results = await Promise.all(
    Object.entries(OPTIMIZE_PIPELINES).map(async ([key, { module, entry }]) => {
      try {
        const mod = await import(new URL(module, import.meta.url).href);
        return await mod[entry]();
      } catch (error) {
        error.message = `[optimize:${key}] ${error.message}`;
        throw error;
      }
    }),
  );
  return results;
}
