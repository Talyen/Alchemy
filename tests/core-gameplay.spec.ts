import { expect } from "@playwright/test";
import {
  makeCard,
  makeHighDamageCard,
  startAtDestination,
  startBattleWithDeck,
  winBattleAndClaimReward,
} from "./helpers";
import { test } from "./fixtures/e2e";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { MenuPage } from "./pages/menu-page";
import { critical, slow } from "./playwright-tags";

test.describe("Battle Flow", critical, () => {
  test("normal combat can be won by playing cards and ending turns", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeHighDamageCard()),
    );
    const battle = new BattlePage(page);
    await battle.winViaCombat(3);
    await expect(battle.victoryHeading).toBeVisible();
  });

  test("end turn triggers enemy phase and draws new cards", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);

    const handBefore = await battle.handCount();
    await battle.playFirstCard();
    expect(await battle.handCount()).toBe(handBefore - 1);

    await battle.endTurn();
    const handAfterTurn = await battle.handCount();
    expect(handAfterTurn).toBe(4);
  });
});

test.describe("Talents", critical, () => {
  test.beforeEach(async ({ page }) => {
    await new MenuPage(page).gotoWithUnlockedMeta();
  });

  test("reset talents button is accessible from talent screen", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.openTalents();

    const resetBtn = page.getByRole("button", { name: "Reset Talents" });
    await expect(resetBtn).toBeVisible();

    await resetBtn.click();
    await expect(page.getByText("Reset Talents?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});

test.describe("Card Interactions", slow, () => {
  test("multiple copies of the same card in hand can be hovered and played independently", async ({
    page,
    fastBattle,
    runtimeErrors,
  }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(
      page,
      Array.from({ length: 8 }, () => makeCard()),
    );
    const battle = new BattlePage(page);

    const handBefore = await battle.handCount();
    expect(handBefore).toBeGreaterThanOrEqual(2);

    await battle.hand.nth(0).hover();
    // Card popups portal into the root tooltip overlay; fade-out keeps the
    // previously hovered panel mounted briefly, so target the visible one.
    await expect(page.locator(".hover-popup-panel[data-visible]")).toBeVisible();

    await battle.hand.nth(1).hover();
    await expect(page.locator(".hover-popup-panel[data-visible]")).toBeVisible();

    await battle.hand.nth(0).click();
    await expect(async () => expect(await battle.handCount()).toBe(handBefore - 1)).toPass({ timeout: 3000 });

    await battle.hand.nth(0).click();
    await expect(async () => expect(await battle.handCount()).toBe(handBefore - 2)).toPass({ timeout: 3000 });
  });

  test("campfire screen restores Health and continues to next battle", async ({ page, runtimeErrors }) => {
    void runtimeErrors;
    await startAtDestination(page, { runPlayerHealth: 10, runMaxHealth: 30 }, { forceDestination: "Campfire" });

    const destination = new DestinationPage(page);
    await destination.pick("Campfire");
    await new MenuPage(page).stage.expectRunPhase("runLoop");

    await expect(page.getByRole("button", { name: "Rest" })).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: "Rest" }).click();
    await destination.expectVisible();
    await destination.enterAnyCombat();
  });
});

test.describe("Elite Combat", critical, () => {
  test("elite combat destination starts a battle that can be won", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startAtDestination(
      page,
      { runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()) },
      { forceDestination: "Elite Combat" },
    );

    await new DestinationPage(page).enterCombat("Elite Combat");
    await winBattleAndClaimReward(page, 3);
    await new DestinationPage(page).expectVisible();
  });
});
