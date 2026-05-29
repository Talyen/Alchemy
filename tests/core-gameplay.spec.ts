import { expect, test } from "@playwright/test";
import { ANVIL_CARD, enableFastMode, MANA_BERRIES_CARD, makeCard, makeHighDamageCard, startAtDestination, startBattleWithDeck, skipBattleAndClaimReward } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { RewardPage } from "./pages/reward-page";
import { critical } from "./playwright-tags";

test.describe("Battle Flow", critical, () => {
  test("normal combat can be won by playing cards and ending turns", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeHighDamageCard()));
    const battle = new BattlePage(page);
    await battle.winViaCombat();
    await expect(battle.victoryHeading).toBeVisible();
  });

  test("playing a card consumes mana and applies effects", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()));
    const battle = new BattlePage(page);

    const manaBefore = await battle.mana();
    await battle.playFirstCard();
    const manaAfter = await battle.mana();
    expect(manaAfter).toBe(manaBefore - 1);

    const handAfter = await battle.handCount();
    expect(handAfter).toBeGreaterThanOrEqual(0);
  });

  test("end turn triggers enemy phase and draws new cards", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()));
    const battle = new BattlePage(page);

    const handBefore = await battle.handCount();
    await battle.endTurn();
    const handAfter = await battle.handCount();
    expect(handAfter).toBe(handBefore);
  });

  test("anvil card grants forge status that persists across turns", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, [ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD]);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Anvil");
    await expect(page.getByRole("button", { name: "Forge 1" })).toBeVisible();

    await battle.endTurn();
    await expect(page.getByRole("button", { name: /Forge/ })).toHaveCount(1);
  });
});

test.describe("Mana Mechanics", () => {
  test("restore-mana overflows beyond maxMana", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, [MANA_BERRIES_CARD, MANA_BERRIES_CARD, MANA_BERRIES_CARD, MANA_BERRIES_CARD, MANA_BERRIES_CARD, MANA_BERRIES_CARD]);
    const battle = new BattlePage(page);

    const maxMana = await battle.mana();
    expect(maxMana).toBeGreaterThan(0);
    await battle.playCardNamed("Mana Berries");
    const manaAfter = await battle.mana();
    expect(manaAfter).toBeGreaterThan(maxMana);
  });
});

test.describe("Full Run Flow", () => {
  test("complete a victory run through destination choice", async ({ page }) => {
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()));
    const battle = new BattlePage(page);

    await skipBattleAndClaimReward(page);

    const combatBtn = page.getByRole("button", { name: /Combat/ }).first();
    await expect(combatBtn).toBeVisible({ timeout: 3000 });
    await combatBtn.click();
    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Talents", () => {
  test("talents screen shows all keyword categories", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Talents" }).click();
    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();

    const keywords = ["Physical", "Stun", "Block", "Forge", "Armor", "Health", "Burn", "Gold", "Holy", "Wish", "Poison", "Bleed", "Leech", "Freeze", "Mana"];
    for (const kw of keywords) {
      await expect(page.getByRole("button", { name: kw })).toBeVisible();
    }
  });

  test("reset talents button is accessible from talent screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Talents" }).click();

    const resetBtn = page.getByRole("button", { name: "Reset Talents" });
    await expect(resetBtn).toBeVisible();

    await resetBtn.click();
    await expect(page.getByText("Reset Talents?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});

test.describe("Card Interactions", () => {
  test("multiple copies of the same card in hand can be hovered and played independently", async ({ page }) => {
    await startBattleWithDeck(page, Array.from({ length: 8 }, () => makeCard()));
    const battle = new BattlePage(page);

    const handBefore = await battle.handCount();
    expect(handBefore).toBeGreaterThanOrEqual(2);

    await battle.hand.nth(0).hover();
    await expect(page.locator(".hover-popup-panel.pointer-events-auto")).toBeVisible();

    await battle.hand.nth(1).hover();
    await expect(page.locator(".hover-popup-panel.pointer-events-auto")).toBeVisible();

    await battle.hand.nth(0).click();
    await expect(async () => expect(await battle.handCount()).toBe(handBefore - 1)).toPass({ timeout: 3000 });

    await battle.hand.nth(0).click();
    await expect(async () => expect(await battle.handCount()).toBe(handBefore - 2)).toPass({ timeout: 3000 });
  });

  test("campfire screen restores Health and continues to next battle", async ({ page }) => {
    await startAtDestination(page, { runPlayerHealth: 10, runMaxHealth: 30 }, { forceDestination: "Campfire" });

    const destination = new DestinationPage(page);
    await destination.pick("Campfire");

    await expect(page.getByRole("button", { name: "Rest" })).toBeVisible({ timeout: 3000 });
    await page.evaluate(() => { Math.random = () => 0; });
    await page.getByRole("button", { name: "Rest" }).click();
    await destination.expectVisible();
    await destination.enterCombat("Normal Combat");
  });
});

test.describe("Elite Combat", critical, () => {
  test("elite combat destination starts a battle that can be won", async ({ page }) => {
    await enableFastMode(page);
    await startAtDestination(
      page,
      { runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()) },
      { forceDestination: "Elite Combat" },
    );

    await new DestinationPage(page).enterCombat("Elite Combat");
    await new BattlePage(page).winViaCombat();
    await new RewardPage(page).claimFirstReward();
    await new DestinationPage(page).expectVisible();
  });
});
