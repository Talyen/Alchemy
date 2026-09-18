#!/usr/bin/env node
import { isMainModule } from "./lib/is-main-module.mjs";
import { optimizationFailures, runAllOptimizePipelinesSettled } from "./optimize-pipelines.mjs";
import { syncArtBarrels } from "./sync-art-barrels.mjs";
import { syncVersionMetadata } from "./sync-version-metadata.mjs";

/** Validate source hashes, output bytes, inventories, and generated code without writing. */
export async function checkPreparedAssets() {
  if (process.env.ALCHEMY_SKIP_ASSETS === "1") {
    throw new Error("assets:check cannot run with ALCHEMY_SKIP_ASSETS=1.");
  }
  const results = await runAllOptimizePipelinesSettled({ check: true });
  const failures = optimizationFailures(results);
  // Art barrels and version metadata are independent outputs; check both so a
  // stale version stamp can't hide behind current art (or vice versa).
  const syncResults = await Promise.allSettled([syncArtBarrels({ check: true }), syncVersionMetadata({ check: true })]);
  for (const result of syncResults) {
    if (result.status === "rejected") {
      failures.push(
        result.reason instanceof Error ? result.reason : new Error(String(result.reason), { cause: result.reason }),
      );
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map((error) => error.message || String(error)).join("\n"));
  }
  console.log("Prepared asset outputs are current.");
}

if (isMainModule(import.meta.url)) {
  checkPreparedAssets().catch((error) => {
    console.error("Prepared asset check failed. Run npm run assets to regenerate stale outputs.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
