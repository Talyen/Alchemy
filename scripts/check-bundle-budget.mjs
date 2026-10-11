#!/usr/bin/env node
import { releaseEdition } from "./lib/release/game-edition.mjs";
// Enforces bundle size budget for the no-lazy eager entry invariant.
// Replaces the former chunkSizeWarningLimit:900 silence with a real gate.
import { readdirSync, statSync, existsSync } from "node:fs";
import { basename, join } from "node:path";

import { BUDGETS } from "./lib/verification/bundle-budget.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { REPO_ROOT } from "./lib/repository-paths.mjs";

const DEFAULT_ASSETS_DIR = join(REPO_ROOT, releaseEdition().rendererDirectory, "assets");

function chunkPattern(name) {
  return new RegExp(`^${name}-[A-Za-z0-9_-]+\\.js$`);
}

function jsAssets(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const assetPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return jsAssets(assetPath).map((asset) => ({ ...asset, name: join(entry.name, asset.name) }));
    }
    if (!entry.name.endsWith(".js")) return [];
    const stat = statSync(assetPath);
    return stat.isFile() ? [{ name: entry.name, bytes: stat.size }] : [];
  });
}

function checkSingleBudget(dir) {
  const assets = jsAssets(dir);
  if (assets.length === 0) {
    console.error(`[bundle-budget] FAIL ${dir}: no JavaScript assets (run npm run build first)`);
    return false;
  }
  const indexAsset = assets.find((a) => chunkPattern("index").test(basename(a.name)));
  if (!indexAsset) {
    console.error(`[bundle-budget] FAIL ${dir}: index chunk not found (expected index-*.js)`);
    return false;
  }
  if (indexAsset.bytes === 0) {
    console.error(`[bundle-budget] FAIL ${dir}: index chunk is empty (run npm run build first)`);
    return false;
  }
  const totalJs = assets.reduce((sum, a) => sum + a.bytes, 0);
  let failed = false;
  if (totalJs > BUDGETS.totalJsMaxBytes) {
    console.error(`[bundle-budget] FAIL ${dir} total js ${totalJs} > ${BUDGETS.totalJsMaxBytes}`);
    failed = true;
  } else {
    console.log(`[bundle-budget] pass ${dir} total js ${totalJs} <= ${BUDGETS.totalJsMaxBytes}`);
    if (BUDGETS.totalJsWarnBytes && totalJs > BUDGETS.totalJsWarnBytes) {
      console.warn(
        `[bundle-budget] WARN ${dir} total js ${totalJs} exceeds 95% of budget (${BUDGETS.totalJsWarnBytes}); next growth needs a measured allowance update`,
      );
    }
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
  const customDirs = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  process.exitCode = checkBundleBudget(customDirs.length > 0 ? customDirs : DEFAULT_ASSETS_DIR) ? 0 : 1;
}
