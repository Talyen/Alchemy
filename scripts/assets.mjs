#!/usr/bin/env node
import { isMainModule } from "./lib/is-main-module.mjs";
import { prepareAssets } from "./prepare-assets.mjs";
import { checkPreparedAssets } from "./check-prepared-assets.mjs";
import { runAllOptimizePipelines } from "./optimize-pipelines.mjs";
import { syncGenerated } from "./sync-generated.mjs";

function printHelp() {
  console.log(`Usage: node scripts/assets.mjs [command]
  Canonical asset CLI (predev runs --prepare over the same pipeline).
  --prepare (default)  Run full asset prep (art+sounds+music+art barrels+version)
  --optimize           Run art/sound/music optimization only (skips barrel sync)
  --sync               Run barrel sync only (art barrels + version metadata;
                       use --art-only/--gear-only/--version-only via sync:art,
                       sync:gear-art, sync:version for finer slices)
  --check              Verify outputs are up-to-date. Alone with --prepare (the
                       default mode) this is the full read-only check, same as
                       npm run assets:check. With --optimize/--sync it checks
                       only that stage (per-stage { check: true }).
  --help               Show this help
  ALCHEMY_SKIP_ASSETS=1 skips mutating commands in this CLI (--check still
  verifies and therefore errors under the skip).`);
}

const KNOWN_FLAGS = new Set(["--prepare", "--optimize", "--sync", "--check", "--help", "-h"]);

export function parseAssetArgs(argv) {
  const unknown = argv.filter((arg) => !KNOWN_FLAGS.has(arg));
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown.join(", ")}`);
  const modes = ["--prepare", "--optimize", "--sync"].filter((flag) => argv.includes(flag));
  if (modes.length > 1) throw new Error("Conflicting asset modes.");
  return {
    help: argv.includes("--help") || argv.includes("-h"),
    check: argv.includes("--check"),
    mode: modes[0] ?? "--prepare",
  };
}

async function main() {
  let options;
  try {
    options = parseAssetArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printHelp();
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    printHelp();
    return;
  }
  await runAssetCommand(options);
}

/** Dispatch a parsed CLI selection; exported for tests. */
export async function runAssetCommand(options) {
  if (!options.check && process.env.ALCHEMY_SKIP_ASSETS === "1") {
    console.log("Skipping asset operation (ALCHEMY_SKIP_ASSETS=1).");
    return;
  }
  if (options.mode === "--sync") {
    await syncGenerated({ check: options.check });
    return;
  }
  if (options.mode === "--optimize") {
    await runAllOptimizePipelines(options.check ? { check: true } : undefined);
    return;
  }
  if (options.check) {
    await checkPreparedAssets();
    return;
  }
  await prepareAssets();
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
