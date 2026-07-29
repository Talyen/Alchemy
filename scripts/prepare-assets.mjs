import { optimizeAssets } from "./optimize-assets.mjs";
import { optimizeMusic } from "./optimize-music.mjs";
import { optimizeSounds } from "./optimize-sounds.mjs";
import { syncAssets } from "./sync-assets.mjs";
import { syncGearArt } from "./sync-gear-art.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

/**
 * Single in-process orchestrator for predev/prebuild asset prep.
 * Order: optimize art → sync assets → sync gear art → optimize sounds → optimize music.
 */
export async function prepareAssets() {
  if (process.env.ALCHEMY_SKIP_ASSETS === "1") {
    console.log("Skipping asset preparation (ALCHEMY_SKIP_ASSETS=1).");
    return;
  }

  await optimizeAssets();
  if (process.exitCode && process.exitCode !== 0) {
    throw new Error("Art optimization failed.");
  }

  await syncAssets();
  await syncGearArt();

  await optimizeSounds();
  if (process.exitCode && process.exitCode !== 0) {
    throw new Error("Sound optimization failed.");
  }

  await optimizeMusic();
  if (process.exitCode && process.exitCode !== 0) {
    throw new Error("Music optimization failed.");
  }
}

if (isMainModule(import.meta.url)) {
  prepareAssets().catch((error) => {
    console.error("Asset preparation failed.");
    console.error(error);
    process.exitCode = 1;
  });
}
