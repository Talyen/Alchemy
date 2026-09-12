#!/usr/bin/env node
import { isMainModule } from "./lib/is-main-module.mjs";
import { optimizationFailures, runAllOptimizePipelinesSettled } from "./optimize-pipelines.mjs";
import { syncGenerated } from "./sync-generated.mjs";

/** Validate source hashes, output bytes, inventories, and generated code without writing. */
export async function checkPreparedAssets() {
  if (process.env.ALCHEMY_SKIP_ASSETS === "1") {
    throw new Error("assets:check cannot run with ALCHEMY_SKIP_ASSETS=1.");
  }
  const results = await runAllOptimizePipelinesSettled({ check: true });
  const failures = optimizationFailures(results);
  try {
    await syncGenerated({ check: true });
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map(String).join("\n"));
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
