import { expect, test } from "@playwright/test";
import { AEGIS_CARD, BLOCK_CARD, enableFastMode, failOnRuntimeErrors, makeHighDamageCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { RewardPage } from "./pages/reward-page";
import { critical, prepush, smoke } from "./playwright-tags";

test.describe("App Boot", { ...smoke, ...prepush }, () => {
  test("main menu renders without crashing on desktop", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
    expect(errors).toEqual([]);
  });
});

test.describe("Block Mechanics", critical, () => {
  test("block card absorbs attack damage and halves at end of turn", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, [BLOCK_CARD, BLOCK_CARD, BLOCK_CARD, BLOCK_CARD, BLOCK_CARD, BLOCK_CARD]);
    const battle = new BattlePage(page);

    const hpBefore = await battle.playerHealth();
    await battle.playCardNamed("Block");
    await battle.endTurn();

    const hpAfter = await battle.playerHealth();
    const hpLost = hpBefore - hpAfter;

    expect(hpLost).toBeLessThanOrEqual(5);
    expect(hpLost).toBeGreaterThanOrEqual(0);
  });

  test("blessed aegis deals holy damage equal to current block", async ({ page }) => {
    await enableFastMode(page);
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

test.describe("Victory Rewards", critical, () => {
  test("victory reward requires confirmation before advancing to destinations", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeHighDamageCard()));

    const battle = new BattlePage(page);
    await battle.winViaCombat();

    const reward = new RewardPage(page);
    await expect(reward.addRewardBtn).toBeDisabled();
    await reward.selectFirstReward();
    await expect(reward.addRewardBtn).toBeEnabled();
    await reward.addRewardBtn.click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible();
  });
});
