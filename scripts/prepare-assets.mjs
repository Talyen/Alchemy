import { optimizeAssets } from "./optimize-assets.mjs";
import { optimizeMusic } from "./optimize-music.mjs";
import { optimizeSounds } from "./optimize-sounds.mjs";
import { syncAssets } from "./sync-assets.mjs";
import { syncGearArt } from "./sync-gear-art.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

/**
 * Single in-process orchestrator for predev/prebuild asset prep.
 * The three transform pipelines (art, sounds, music) are independent — they write
 * to disjoint output directories — so they run concurrently. Art must finish before
 * syncAssets/syncGearArt because those regenerate barrels from its manifest.
 */
export async function prepareAssets() {
  if (process.env.ALCHEMY_SKIP_ASSETS === "1") {
    console.log("Skipping asset preparation (ALCHEMY_SKIP_ASSETS=1).");
    return;
  }

  const results = await Promise.allSettled([optimizeAssets(), optimizeSounds(), optimizeMusic()]);
  const [artResult, soundsResult, musicResult] = results;
  const failures = [];
  const pipelineFailed = (result) => result.status === "rejected" || !result.value.ok;

  if (pipelineFailed(artResult)) {
    failures.push("Art optimization failed.");
  }
  if (pipelineFailed(soundsResult)) failures.push("Sound optimization failed.");
  if (pipelineFailed(musicResult)) failures.push("Music optimization failed.");

  if (artResult.status === "fulfilled" && artResult.value.ok) {
    // Both regenerate barrels from the completed art manifest but write disjoint outputs.
    await Promise.all([syncAssets(), syncGearArt()]);
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
