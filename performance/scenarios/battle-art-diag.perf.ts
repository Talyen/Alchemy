import { seedRandom } from "../../tests/e2e/rng";
import { test } from "../fixtures";
import { weakEndTurnDeck } from "../scenario-data";
import { startPerfBattle } from "../battle-setup";
import {
  trackFailedAssetRequests,
  writeBattleArtDiagnostics,
  formatArtDiagnosticFailure,
} from "../battle-art-diagnostics";

/**
 * Headed evidence capture for blank battle art.
 * Does not measure FPS — only dumps screenshot + img/layout/network facts.
 */
test.describe("battle-art-diag", () => {
  test("capture battle art diagnostics", async ({ perfPage }) => {
    const tracker = trackFailedAssetRequests(perfPage);
    try {
      await seedRandom(perfPage, 42);
      await startPerfBattle(perfPage, weakEndTurnDeck());
      // Give one paint frame after readiness for layout to settle.
      await perfPage.waitForTimeout(300);
      const { dir, diagnostics, ok } = await writeBattleArtDiagnostics(perfPage, {
        failedAssetRequests: tracker.failures,
      });
      // Always leave artifacts; fail if any bucket trips.
      if (!ok) {
        throw new Error(formatArtDiagnosticFailure(diagnostics, dir));
      }
      console.log(`Battle art OK. Diagnostics: ${dir}/diagnostics.json`);
    } finally {
      tracker.dispose();
    }
  });
});
