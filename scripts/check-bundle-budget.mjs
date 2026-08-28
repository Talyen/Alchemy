#!/usr/bin/env node
// Enforces bundle size budget for the no-lazy eager entry invariant.
// Replaces the former chunkSizeWarningLimit:900 silence with a real gate.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist/assets";
// Hitch-free invariant: entry stays eager (no React.lazy), so budget gates size, not chunk count.
export const BUDGETS = {
  // Main eager entry (app, screens, features) — 572kB observed Aug 28 2026.
  indexMaxBytes: 600 * 1024,
  // Sum of all js chunks in dist/assets — 1.51MB observed; gate prevents silent growth.
  totalJsMaxBytes: 1_550 * 1024,
};

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

  // Prefer strict index pattern; fall back to largest chunk so renames don't silently skip the gate.
  const INDEX_PATTERN = /^index-[A-Za-z0-9_-]+\.js$/;
  const indexAsset =
    assets.find((a) => INDEX_PATTERN.test(a.name)) ??
    assets.reduce((max, a) => (a.bytes > max.bytes ? a : max), assets[0]);
  const isIndexMatch = indexAsset ? INDEX_PATTERN.test(indexAsset.name) : false;
  const totalJs = assets.reduce((sum, a) => sum + a.bytes, 0);
  let failed = false;

  if (indexAsset) {
    if (!isIndexMatch) {
      console.warn(
        `[bundle-budget] index pattern not matched, checking largest asset ${indexAsset.name} against index budget`,
      );
    }
    if (indexAsset.bytes > BUDGETS.indexMaxBytes) {
      console.error(
        `[bundle-budget] FAIL ${indexAsset.name} ${indexAsset.bytes} > ${BUDGETS.indexMaxBytes} (eager entry). ` +
          `Reduce app chunk or update budget with justification.`,
      );
      failed = true;
    } else {
      console.log(`[bundle-budget] pass ${indexAsset.name} ${indexAsset.bytes} <= ${BUDGETS.indexMaxBytes}`);
    }
  } else {
    console.warn("[bundle-budget] index chunk not found — skip index check");
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
