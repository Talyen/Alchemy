import { expect, test } from "../../fixtures/e2e";
import { BattlePage } from "../../pages/battle-page";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../../browser-helpers";
import { readSfxPlays, resetSfxPlays, trackSfxPlays } from "../../pages/audio-harness";
import { critical } from "../../playwright-tags";

test.describe("SFX playback", critical, () => {
  test("playing Slash successfully starts its registered SFX", async ({ page }) => {
    // Only this cue counts; a late battle-start sound cannot satisfy the check.
    await trackSfxPlays(page, "sword-attack-1.");
    const card = makeCard({ cost: 0 });
    await injectActiveBattle(page, makeGoblinBattleState({ hand: [card] }), {
      runDeck: [card],
      autoEndTurn: false,
    });
    const battle = new BattlePage(page);
    await battle.waitForOpeningHand();
    await resetSfxPlays(page);
    await battle.playFirstCard();
    await expect(battle.hand).toHaveCount(0);
    await expect.poll(() => readSfxPlays(page)).toBeGreaterThan(0);
  });
});
