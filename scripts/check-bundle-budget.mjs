#!/usr/bin/env node
// Enforces bundle size budget for the no-lazy eager entry invariant.
// Replaces the former chunkSizeWarningLimit:900 silence with a real gate.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

import { BUDGETS } from "./lib/bundle-budget.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { CHUNK_GROUP_NAMES } from "./lib/vite-chunks.mjs";

const DISTS = ["dist/assets", "dist-desktop/assets"];

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
  if (assets.length === 0) return null;
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

export function checkBundleBudget(dist = DISTS) {
  const dirs = Array.isArray(dist) ? dist : [dist];
  const existing = dirs.filter((dir) => existsSync(dir) && jsAssets(dir).length > 0);
  if (existing.length === 0) {
    console.warn(`[bundle-budget] no ${dirs.join(" or ")} — skip (run npm run build first)`);
    return true;
  }
  let ok = true;
  for (const dir of existing) {
    const result = checkSingleBudget(dir);
    if (result === false) ok = false;
  }
  return ok;
}

const isMain = isMainModule(import.meta.url);
if (isMain || (process.argv[1] && process.argv[1].includes("check-bundle-budget"))) {
  const ok = checkBundleBudget();
  process.exit(ok ? 0 : 1);
}
