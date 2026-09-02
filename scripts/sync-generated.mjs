import { deprecated } from "./lib/deprecated.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { syncArtBarrels, syncAssets, syncGearArt } from "./sync-art-barrels.mjs";
import { syncVersionMetadata } from "./sync-version-metadata.mjs";

export { syncAssets, syncGearArt, syncArtBarrels };

export async function syncGenerated({ check = false, artOnly = false, gearOnly = false, versionOnly = false } = {}) {
  if (artOnly) {
    await syncAssets({ check });
    return;
  }
  if (gearOnly) {
    await syncGearArt({ check });
    return;
  }
  if (versionOnly) {
    await syncVersionMetadata({ check });
    return;
  }
  await Promise.all([syncArtBarrels({ check }), syncVersionMetadata({ check })]);
}

function printHelp() {
  console.log(`Usage: node scripts/sync-generated.mjs [--check] [--art-only|--gear-only|--version-only]
  Default syncs art barrels + version metadata.
  Fine-grained syncs (deprecated shims node scripts/sync-assets.mjs and sync-gear-art.mjs forward here):
    --art-only      Sync assets.generated.ts only
    --gear-only     Sync gear-art.ts only
    --version-only  Sync metadata.generated.ts only`);
}

if (isMainModule(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
  } else {
    if (argv.includes("--assets-only")) deprecated("--assets-only", "--art-only");
    syncGenerated({
      check: argv.includes("--check"),
      artOnly: argv.includes("--art-only") || argv.includes("--assets-only"),
      gearOnly: argv.includes("--gear-only"),
      versionOnly: argv.includes("--version-only"),
    }).catch((error) => {
      console.error("Failed to sync generated modules:", error);
      process.exitCode = 1;
    });
  }
}
