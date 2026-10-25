import { optimizeAssets } from "../optimize-assets.mjs";
import { optimizeMusic } from "../optimize-music.mjs";
import { optimizeSounds } from "../optimize-sounds.mjs";
import { optimizeBossIdles } from "../optimize-boss-idles.mjs";
import { LOW_MEMORY_ASSETS } from "./asset-constants.mjs";

const OPTIMIZE_PIPELINES = {
  bossIdles: { label: "Boss idles", run: optimizeBossIdles },
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

export async function runAllOptimizePipelinesSettled(options) {
  const pipelines = Object.entries(OPTIMIZE_PIPELINES);
  const results = [];
  if (LOW_MEMORY_ASSETS) {
    for (const [, pipeline] of pipelines) {
      const [result] = await Promise.allSettled([Promise.resolve().then(() => pipeline.run(options))]);
      results.push(result);
    }
  } else {
    const batch = await Promise.allSettled(pipelines.map(async ([, pipeline]) => pipeline.run(options)));
    results.push(...batch);
  }
  return results.map((result, index) => ({ key: pipelines[index][0], ...result }));
}

export function optimizationFailures(results) {
  return results.flatMap((result) => {
    if (result.status === "fulfilled" && result.value?.ok) return [];
    const reason = result.status === "rejected" ? result.reason : (result.value?.error ?? "failed");
    const detail = reason instanceof Error ? reason.message : String(reason);
    return [new Error(`${result.key}: ${detail}`, { cause: reason })];
  });
}

export async function runAllOptimizePipelines(options) {
  const results = await runAllOptimizePipelinesSettled(options);
  const failures = optimizationFailures(results);
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Asset optimization failed: ${failures.map((error) => error.message).join("\n")}`,
    );
  }
  return results.map((result) => (result.status === "fulfilled" ? result.value : undefined));
}
