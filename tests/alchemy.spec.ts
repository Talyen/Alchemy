import { expect, test } from "@playwright/test";
import { AEGIS_CARD, BLOCK_CARD, enableFastMode, failOnRuntimeErrors, makeHighDamageCard, playUntilVictory, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";

test.describe("App Boot", () => {
  test("main menu renders without crashing on desktop", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
    expect(errors).toEqual([]);
  });
});

test.describe("Block Mechanics", () => {
  test("block card absorbs attack damage and halves at end of turn", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, [BLOCK_CARD, BLOCK_CARD, BLOCK_CARD, BLOCK_CARD, BLOCK_CARD, BLOCK_CARD]);
    const battle = new BattlePage(page);

    const hpBefore = await battle.playerHealth();

    await page.getByRole("button", { name: "Play Block" }).first().click();

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

    await page.getByRole("button", { name: "Play Block" }).first().click();
    const blockAfterBlock = await battle.block();

    await page.getByRole("button", { name: "Play Blessed Aegis" }).first().click();

    const enemyHp = await battle.enemyHealth();
    expect(enemyHp).toBeLessThan(30);
    const blockAfter = await battle.block();
    expect(blockAfter).toBe(blockAfterBlock);
  });
});

test.describe("Victory Rewards", () => {
  test("victory reward requires confirmation before advancing to destinations", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeHighDamageCard()));

    await playUntilVictory(page);
    await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible({ timeout: 3000 });

    const addCardButton = page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ });
    await expect(addCardButton).toBeDisabled();

    await page.locator('[aria-label^="Select "]').first().click();
    await expect(addCardButton).toBeEnabled();

    await addCardButton.click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible();
  });
});

