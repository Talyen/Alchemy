import { expect, test as baseTest } from "@playwright/test";
import { AEGIS_CARD, BLOCK_CARD, failOnRuntimeErrors, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical, prepush, smoke } from "./playwright-tags";

baseTest.describe("App Boot", { tag: [smoke.tag, prepush.tag] }, () => {
  baseTest("main menu renders without crashing on desktop", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
    expect(errors).toEqual([]);
  });
});

test.describe("Block Mechanics", critical, () => {
  // Damage math is pinned in tests/lib/battle/damage-holy.test.ts (holy
  // equalToBlock) and tests/lib/battle/damage-base.test.ts (physical); this
  // covers the UI-integration fact that both cards play off a live block value.
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
