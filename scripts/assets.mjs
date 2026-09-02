#!/usr/bin/env node
import { isMainModule } from "./lib/is-main-module.mjs";
import { prepareAssets } from "./prepare-assets.mjs";
import { runAllOptimizePipelines } from "./optimize-pipelines.mjs";
import { syncGenerated } from "./sync-generated.mjs";

function printHelp() {
  console.log(`Usage: node scripts/assets.mjs [command]
  Canonical asset CLI (node scripts/prepare-assets.mjs is the predev library entry over the same pipeline).
  --prepare (default)  Run full asset prep (art+sounds+music+sync)
  --optimize           Run art/sound/music optimization only
  --sync               Run barrel sync only (art barrels + version metadata; add --check to verify)
  --check              Verify generated barrels are up-to-date (implies --sync --check)
  --help               Show this help`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  const hasOptimize = args.includes("--optimize");
  const hasSync = args.includes("--sync");
  const check = args.includes("--check");
  const hasPrepare = args.includes("--prepare") || args.length === 0;

  if (check || hasSync) {
    await syncGenerated({ check });
    return;
  }
  if (hasOptimize) {
    await runAllOptimizePipelines();
    return;
  }
  if (hasPrepare) {
    await prepareAssets();
    return;
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { prepareAssets };
