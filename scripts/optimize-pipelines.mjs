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
  const pipelines = Object.entries(OPTIMIZE_PIPELINES);
  const results = await Promise.allSettled(pipelines.map(async ([, pipeline]) => pipeline.run()));
  return results.map((result, index) => ({ key: pipelines[index][0], ...result }));
}

export function optimizationFailures(results) {
  return results.flatMap((result) => {
    if (result.status === "fulfilled" && result.value?.ok) return [];
    const reason = result.status === "rejected" ? result.reason : (result.value?.error ?? "failed");
    return [new Error(`${result.key}: ${String(reason)}`, { cause: reason })];
  });
}

export async function runAllOptimizePipelines() {
  const results = await runAllOptimizePipelinesSettled();
  const failures = optimizationFailures(results);
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Asset optimization failed: ${failures.map((error) => error.message).join(" ")}`,
    );
  }
  return results.map((result) => (result.status === "fulfilled" ? result.value : undefined));
}
