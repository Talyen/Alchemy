import { optimizeAssets } from "./optimize-assets.mjs";
import { optimizeMusic } from "./optimize-music.mjs";
import { optimizeSounds } from "./optimize-sounds.mjs";
import { syncGenerated } from "./sync-generated.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

/**
 * Single in-process orchestrator for predev/prebuild asset prep.
 * The three transform pipelines (art, sounds, music) are independent — they write
 * to disjoint output directories — so they run concurrently. Art must finish before
 * syncGenerated because it regenerates barrels from its manifest.
 */
export async function prepareAssets() {
  if (process.env.ALCHEMY_SKIP_ASSETS === "1") {
    console.log("Skipping asset preparation (ALCHEMY_SKIP_ASSETS=1).");
    return;
  }

  const results = await Promise.allSettled([optimizeAssets(), optimizeSounds(), optimizeMusic()]);
  const [artResult, soundsResult, musicResult] = results;
  const failures = [];
  const pipelineFailed = (result) => result.status === "rejected" || !result.value?.ok;
  const pipelineReason = (result) =>
    result.status === "rejected" ? String(result.reason) : result.value?.error ? String(result.value.error) : "";

  if (pipelineFailed(artResult)) {
    const detail = pipelineReason(artResult);
    failures.push(detail ? `Art optimization failed: ${detail}` : "Art optimization failed.");
  }
  if (pipelineFailed(soundsResult)) {
    const detail = pipelineReason(soundsResult);
    failures.push(detail ? `Sound optimization failed: ${detail}` : "Sound optimization failed.");
  }
  if (pipelineFailed(musicResult)) {
    const detail = pipelineReason(musicResult);
    failures.push(detail ? `Music optimization failed: ${detail}` : "Music optimization failed.");
  }

  if (artResult.status === "fulfilled" && artResult.value.ok) {
    await syncGenerated();
  } else {
    console.warn("Skipping generated art barrels because art optimization did not complete successfully.");
  }

  if (failures.length > 0) {
    throw new Error(failures.join(" "));
  }
}

if (isMainModule(import.meta.url)) {
  prepareAssets().catch((error) => {
    console.error("Asset preparation failed.");
    console.error(error);
    process.exitCode = 1;
  });
}
