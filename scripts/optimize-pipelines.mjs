import { optimizeAssets } from "./optimize-assets.mjs";
import { optimizeMusic } from "./optimize-music.mjs";
import { optimizeSounds } from "./optimize-sounds.mjs";

export const OPTIMIZE_PIPELINES = {
  art: {
    label: "Art",
    run: optimizeAssets,
  },
  sound: {
    label: "Sound",
    run: optimizeSounds,
  },
  music: {
    label: "Music",
    run: optimizeMusic,
  },
};

export async function runAllOptimizePipelinesSettled() {
  const results = await Promise.allSettled(
    Object.entries(OPTIMIZE_PIPELINES).map(async ([key, pipeline]) => {
      try {
        return await pipeline.run();
      } catch (error) {
        error.message = `[optimize:${key}] ${error.message}`;
        throw error;
      }
    }),
  );
  return results;
}

export async function runAllOptimizePipelines() {
  const results = await runAllOptimizePipelinesSettled();
  const failures = results
    .map((result, index) => ({ result, key: Object.keys(OPTIMIZE_PIPELINES)[index] }))
    .filter(({ result }) => result.status === "rejected" || !result.value?.ok);
  if (failures.length > 0) {
    const details = failures
      .map(({ result, key }) =>
        result.status === "rejected"
          ? `${key}: ${String(result.reason)}`
          : `${key}: ${String(result.value?.error ?? "failed")}`,
      )
      .join(" ");
    throw new Error(`Asset optimization failed: ${details}`);
  }
  return results.map((result) => (result.status === "fulfilled" ? result.value : undefined));
}
