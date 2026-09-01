import { AEGIS_CARD, BLOCK_CARD, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";

test.describe("Block Mechanics", critical, () => {
  test("blessed aegis plays against a live block value", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(page, [BLOCK_CARD, AEGIS_CARD, BLOCK_CARD, AEGIS_CARD, BLOCK_CARD, AEGIS_CARD]);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Block");
    await expect.poll(async () => battle.block(), { timeout: 5000 }).toBeGreaterThan(0);
    const blockBeforeAegis = await battle.block();

    await battle.playCardNamed("Blessed Aegis");
    await expect.poll(async () => battle.enemyHealth(), { timeout: 5000 }).toBeLessThan(30);
    expect(await battle.block()).toBe(blockBeforeAegis);
  });
});
