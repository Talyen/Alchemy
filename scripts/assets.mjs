#!/usr/bin/env node
import { isMainModule } from "./lib/is-main-module.mjs";
import { prepareAssets } from "./prepare-assets.mjs";
import { runAllOptimizePipelines } from "./optimize-pipelines.mjs";
import { syncGenerated } from "./sync-generated.mjs";

function printHelp() {
  console.log(`Usage: node scripts/assets.mjs [command]
  Canonical asset CLI (predev runs --prepare over the same pipeline).
  --prepare (default)  Run full asset prep (art+sounds+music+sync)
  --optimize           Run art/sound/music optimization only (skips barrel sync)
  --sync               Run barrel sync only (art barrels + version metadata; add --check to verify)
  --check              Verify generated barrels are up-to-date (implies --sync --check)
  --help               Show this help
  ALCHEMY_SKIP_ASSETS=1 skips all commands in this CLI.`);
}

const KNOWN_FLAGS = new Set(["--prepare", "--optimize", "--sync", "--check", "--help", "-h"]);

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !KNOWN_FLAGS.has(arg));
  const modes = ["--prepare", "--optimize", "--sync"].filter((flag) => args.includes(flag));
  const conflicting = modes.length > 1 || (args.includes("--check") && modes.some((mode) => mode !== "--sync"));
  if (unknown.length > 0 || conflicting) {
    console.error(unknown.length > 0 ? `Unknown argument: ${unknown.join(", ")}` : "Conflicting asset modes.");
    printHelp();
    process.exitCode = 2;
    return;
  }
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  if (process.env.ALCHEMY_SKIP_ASSETS === "1") {
    console.log("Skipping asset operation (ALCHEMY_SKIP_ASSETS=1).");
    return;
  }
  const hasOptimize = args.includes("--optimize");
  const hasSync = args.includes("--sync");
  const check = args.includes("--check");
  if (check || hasSync) {
    await syncGenerated({ check });
    return;
  }
  if (hasOptimize) {
    await runAllOptimizePipelines();
    return;
  }
  await prepareAssets();
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { prepareAssets };
