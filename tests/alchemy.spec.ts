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
  test("blessed aegis deals holy damage equal to current block", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(page, [BLOCK_CARD, AEGIS_CARD, BLOCK_CARD, AEGIS_CARD, BLOCK_CARD, AEGIS_CARD]);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Block");
    const blockAfterBlock = await battle.block();
    await battle.playCardNamed("Blessed Aegis");

    const enemyHp = await battle.enemyHealth();
    expect(enemyHp).toBeLessThan(30);
    const blockAfter = await battle.block();
    expect(blockAfter).toBe(blockAfterBlock);
  });
});
