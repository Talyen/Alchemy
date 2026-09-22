import { isMainModule } from "./lib/is-main-module.mjs";
import { syncArtBarrels, syncGearArt } from "./sync-art-barrels.mjs";
import { syncVersionMetadata } from "./sync-version-metadata.mjs";

export async function syncGenerated({ check = false, artOnly = false, gearOnly = false, versionOnly = false } = {}) {
  if (artOnly) {
    // Both art barrels: gear-art.generated.ts imports assets.generated.ts, so syncing
    // one without the other can only diverge them.
    await syncArtBarrels({ check });
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
  const results = await Promise.allSettled([syncArtBarrels({ check }), syncVersionMetadata({ check })]);
  const failures = results.filter((result) => result.status === "rejected").map((result) => result.reason);
  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map(String).join("\n"));
  }
}

function printHelp() {
  console.log(`Usage: node scripts/sync-generated.mjs [--check] [--art-only|--gear-only|--version-only]
  Default syncs art barrels + version metadata.
  Fine-grained syncs (npm run sync:art / sync:gear-art / sync:version forward here):
    --art-only      Sync both art barrels (assets.generated.ts + gear-art.generated.ts)
    --gear-only     Sync gear-art.generated.ts only (refuses stale assets.generated.ts)
    --version-only  Sync metadata.generated.ts only`);
}

export function parseSyncArgs(argv) {
  const allowed = new Set(["--check", "--art-only", "--gear-only", "--version-only", "--help", "-h"]);
  for (const arg of argv) if (!allowed.has(arg)) throw new Error(`Unknown sync option: ${arg}`);
  if (["--art-only", "--gear-only", "--version-only"].filter((flag) => argv.includes(flag)).length > 1)
    throw new Error("Choose only one of --art-only, --gear-only, or --version-only");
  return {
    check: argv.includes("--check"),
    artOnly: argv.includes("--art-only"),
    gearOnly: argv.includes("--gear-only"),
    versionOnly: argv.includes("--version-only"),
  };
}

if (isMainModule(import.meta.url)) {
  const argv = process.argv.slice(2);
  try {
    const options = parseSyncArgs(argv);
    if (argv.includes("--help") || argv.includes("-h")) printHelp();
    else
      syncGenerated(options).catch((error) => {
        console.error("Failed to sync generated modules:", error);
        process.exitCode = 1;
      });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
