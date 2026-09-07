import { optimizationFailures, runAllOptimizePipelinesSettled } from "./optimize-pipelines.mjs";
import { syncGenerated } from "./sync-generated.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

/**
 * Single in-process orchestrator for predev/prebuild asset prep.
 * The three transform pipelines (art, sounds, music) are independent — they write
 * to disjoint output directories — so they run concurrently via the shared
 * OPTIMIZE_PIPELINES table. Art must finish before syncGenerated because it
 * regenerates barrels from its manifest.
 *
 * Partial-failure rule: art barrels sync whenever art succeeds, even if sounds
 * or music fail (barrel output depends only on art). The aggregated error still
 * throws, so a failed run is never silent — but barrels may advance while sound
 * outputs stay stale until the next green run.
 */
export async function prepareAssets() {
  if (process.env.ALCHEMY_SKIP_ASSETS === "1") {
    console.log("Skipping asset preparation (ALCHEMY_SKIP_ASSETS=1).");
    return;
  }

  const results = await runAllOptimizePipelinesSettled();
  const artResult = results.find((result) => result.key === "art");
  const failures = optimizationFailures(results);

  if (artResult?.status === "fulfilled" && artResult.value.ok) {
    try {
      await syncGenerated();
    } catch (error) {
      failures.push(new Error(`Generated asset synchronization failed: ${String(error)}`, { cause: error }));
    }
  } else {
    console.warn("Skipping generated art barrels because art optimization did not complete successfully.");
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map((error) => error.message).join(" "));
  }
}

if (isMainModule(import.meta.url)) {
  prepareAssets().catch((error) => {
    console.error("Asset preparation failed.");
    console.error(error);
    process.exitCode = 1;
  });
}
