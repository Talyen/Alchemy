#!/usr/bin/env node
// Enforces bundle size budget for the no-lazy eager entry invariant.
// Replaces the former chunkSizeWarningLimit:900 silence with a real gate.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

import { BUDGETS } from "./lib/bundle-budget.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { CHUNK_GROUP_NAMES } from "./lib/vite-chunks.mjs";

const DEFAULT_ASSETS_DIR = "dist/assets";

function chunkPattern(name) {
  return new RegExp(`^${name}-[A-Za-z0-9_-]+\\.js$`);
}

function jsAssets(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => ({ name: f, bytes: statSync(join(dir, f)).size }));
}

function checkSingleBudget(dir) {
  const assets = jsAssets(dir);
  if (assets.length === 0) {
    console.error(`[bundle-budget] FAIL ${dir}: no JavaScript assets (run npm run build first)`);
    return false;
  }
  const indexAsset = assets.find((a) => chunkPattern("index").test(a.name));
  if (!indexAsset) {
    console.error(`[bundle-budget] FAIL ${dir}: index chunk not found (expected index-*.js)`);
    return false;
  }
  const totalJs = assets.reduce((sum, a) => sum + a.bytes, 0);
  let failed = false;
  if (indexAsset.bytes > BUDGETS.indexMaxBytes) {
    console.error(
      `[bundle-budget] FAIL ${dir}/${indexAsset.name} ${indexAsset.bytes} > ${BUDGETS.indexMaxBytes} (eager entry). ` +
        `Reduce app chunk or update budget with justification.`,
    );
    failed = true;
  } else {
    console.log(`[bundle-budget] pass ${dir}/${indexAsset.name} ${indexAsset.bytes} <= ${BUDGETS.indexMaxBytes}`);
  }
  if (totalJs > BUDGETS.totalJsMaxBytes) {
    console.error(`[bundle-budget] FAIL ${dir} total js ${totalJs} > ${BUDGETS.totalJsMaxBytes}`);
    failed = true;
  } else {
    console.log(`[bundle-budget] pass ${dir} total js ${totalJs} <= ${BUDGETS.totalJsMaxBytes}`);
  }
  const gameDataAsset = assets.find((a) => chunkPattern("game-data").test(a.name));
  if (gameDataAsset) {
    if (gameDataAsset.bytes > BUDGETS.gameDataMaxBytes) {
      console.error(
        `[bundle-budget] FAIL ${dir}/${gameDataAsset.name} ${gameDataAsset.bytes} > ${BUDGETS.gameDataMaxBytes} (game-data chunk). ` +
          `Reduce barrel size or raise budget with justification.`,
      );
      failed = true;
    } else {
      console.log(
        `[bundle-budget] pass ${dir}/${gameDataAsset.name} ${gameDataAsset.bytes} <= ${BUDGETS.gameDataMaxBytes}`,
      );
    }
  }
  for (const name of CHUNK_GROUP_NAMES) {
    if (name === "index" || name === "game-data") continue;
    const asset = assets.find((a) => chunkPattern(name).test(a.name));
    if (asset) console.log(`[bundle-budget] info ${dir}/${asset.name} ${asset.bytes}`);
  }
  return !failed;
}

export function checkBundleBudget(dist = DEFAULT_ASSETS_DIR) {
  const dirs = Array.isArray(dist) ? dist : [dist];
  return dirs.map(checkSingleBudget).every(Boolean);
}

if (isMainModule(import.meta.url)) {
  process.exitCode = checkBundleBudget() ? 0 : 1;
}
