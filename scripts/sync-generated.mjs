import { isMainModule } from "./lib/is-main-module.mjs";
import { syncAssets } from "./sync-assets.mjs";
import { syncGearArt } from "./sync-gear-art.mjs";

export async function syncGenerated({ check = false } = {}) {
  await Promise.all([syncAssets({ check }), syncGearArt({ check })]);
}

if (isMainModule(import.meta.url)) {
  syncGenerated({ check: process.argv.includes("--check") }).catch((error) => {
    console.error("Failed to sync generated modules:", error);
    process.exitCode = 1;
  });
}
