#!/usr/bin/env node
import { checkIconAssets } from "./assets/icon-assets.mjs";
import { checkAssetOutputs } from "./assets/check-asset-outputs.mjs";
import { resolveRootDir } from "./assets/asset-pipeline-runner.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { optimizationFailures, runAllOptimizePipelinesSettled } from "./assets/optimize-pipelines.mjs";
import { syncArtBarrels } from "./sync-art-barrels.mjs";
import { syncVersionMetadata } from "./sync-version-metadata.mjs";

/** Validate source hashes, output bytes, inventories, and generated code without writing. */
export async function checkPreparedAssets({ outputsOnly = false } = {}) {
  if (process.env.ALCHEMY_SKIP_ASSETS === "1") {
    throw new Error("assets:check cannot run with ALCHEMY_SKIP_ASSETS=1.");
  }
  const rootDir = resolveRootDir(import.meta.url);
  const failures = [];
  // Art barrels and version metadata are independent outputs; check both so a
  // stale version stamp can't hide behind current art (or vice versa).
  const results = await Promise.allSettled([
    checkIconAssets(rootDir, { outputsOnly }),
    outputsOnly ? checkAssetOutputs(rootDir) : runAllOptimizePipelinesSettled({ check: true }),
    syncArtBarrels({ check: true }),
    syncVersionMetadata({ check: true }),
  ]);
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      failures.push(
        result.reason instanceof Error ? result.reason : new Error(String(result.reason), { cause: result.reason }),
      );
    } else if (index === 1 && !outputsOnly) {
      failures.push(...optimizationFailures(result.value));
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map((error) => error.message || String(error)).join("\n"));
  }
  console.log(
    outputsOnly
      ? "Prepared outputs are consistent (raw-source freshness is checked locally)."
      : "Prepared asset outputs are current.",
  );
}

if (isMainModule(import.meta.url)) {
  checkPreparedAssets().catch((error) => {
    console.error("Prepared asset check failed. Run npm run assets to regenerate stale outputs.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
