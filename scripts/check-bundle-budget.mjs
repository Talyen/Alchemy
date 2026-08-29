#!/usr/bin/env node
// Enforces bundle size budget for the no-lazy eager entry invariant.
// Replaces the former chunkSizeWarningLimit:900 silence with a real gate.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

import { BUDGETS } from "./lib/bundle-budget.mjs";

const DIST = "dist/assets";

function jsAssets(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => ({ name: f, bytes: statSync(join(dir, f)).size }));
}

export function checkBundleBudget(dist = DIST) {
  const assets = jsAssets(dist);
  if (assets.length === 0) {
    console.warn("[bundle-budget] no dist/assets — skip (run npm run build first)");
    return true;
  }

  const INDEX_PATTERN = /^index-[A-Za-z0-9_-]+\.js$/;
  const indexAsset = assets.find((a) => INDEX_PATTERN.test(a.name));
  if (!indexAsset) {
    console.error("[bundle-budget] FAIL index chunk not found (expected index-*.js)");
    return false;
  }
  const totalJs = assets.reduce((sum, a) => sum + a.bytes, 0);
  let failed = false;

  if (indexAsset.bytes > BUDGETS.indexMaxBytes) {
    console.error(
      `[bundle-budget] FAIL ${indexAsset.name} ${indexAsset.bytes} > ${BUDGETS.indexMaxBytes} (eager entry). ` +
        `Reduce app chunk or update budget with justification.`,
    );
    failed = true;
  } else {
    console.log(`[bundle-budget] pass ${indexAsset.name} ${indexAsset.bytes} <= ${BUDGETS.indexMaxBytes}`);
  }

  if (totalJs > BUDGETS.totalJsMaxBytes) {
    console.error(`[bundle-budget] FAIL total js ${totalJs} > ${BUDGETS.totalJsMaxBytes}`);
    failed = true;
  } else {
    console.log(`[bundle-budget] pass total js ${totalJs} <= ${BUDGETS.totalJsMaxBytes}`);
  }

  return !failed;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain || (process.argv[1] && process.argv[1].includes("check-bundle-budget"))) {
  const ok = checkBundleBudget();
  process.exit(ok ? 0 : 1);
}
