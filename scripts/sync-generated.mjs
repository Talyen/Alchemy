import { isMainModule } from "./lib/is-main-module.mjs";
import { syncArtBarrels, syncAssets, syncGearArt } from "./sync-art-barrels.mjs";
import { syncVersionMetadata } from "./sync-version-metadata.mjs";

export { syncAssets, syncGearArt, syncArtBarrels };

export async function syncGenerated({ check = false } = {}) {
  await Promise.all([syncArtBarrels({ check }), syncVersionMetadata({ check })]);
}

if (isMainModule(import.meta.url)) {
  syncGenerated({ check: process.argv.includes("--check") }).catch((error) => {
    console.error("Failed to sync generated modules:", error);
    process.exitCode = 1;
  });
}
