#!/usr/bin/env node
// Enforces bundle size budget for the no-lazy eager entry invariant.
// Replaces the former chunkSizeWarningLimit:900 silence with a real gate.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

import { BUDGETS } from "./lib/bundle-budget.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

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
  if (totalJs > BUDGETS.totalJsMaxBytes) {
    console.error(`[bundle-budget] FAIL ${dir} total js ${totalJs} > ${BUDGETS.totalJsMaxBytes}`);
    failed = true;
  } else {
    console.log(`[bundle-budget] pass ${dir} total js ${totalJs} <= ${BUDGETS.totalJsMaxBytes}`);
  }
  // Chunk boundaries can move without changing the eager download. Report them
  // for diagnosis; only the total measures the budget we intend to enforce.
  for (const asset of assets) console.log(`[bundle-budget] info ${dir}/${asset.name} ${asset.bytes}`);
  return !failed;
}

export function checkBundleBudget(dist = DEFAULT_ASSETS_DIR) {
  const dirs = Array.isArray(dist) ? dist : [dist];
  return dirs.map(checkSingleBudget).every(Boolean);
}

if (isMainModule(import.meta.url)) {
  process.exitCode = checkBundleBudget() ? 0 : 1;
}
