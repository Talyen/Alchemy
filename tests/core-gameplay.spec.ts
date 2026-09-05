import { expect } from "@playwright/test";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import {
  injectActiveBattle,
  makeCard,
  makeHighDamageCard,
  makeGoblinBattleState,
  startAtDestination,
  startBattleWithDeck,
  winBattleAndClaimReward,
} from "./helpers";
import { test } from "./fixtures/e2e";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { expectRunPhase } from "./pages/game-stage";
import { MenuPage } from "./pages/menu-page";
import { critical, slow } from "./playwright-tags";
import { injectHomestead, injectTalentUnlocks } from "./e2e/save-injection";

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

  test("maximum hand remains visible beyond the battle scene boundary", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await injectActiveBattle(
      page,
      makeGoblinBattleState({
        hand: Array.from({ length: MAX_HAND_SIZE }, () => makeCard()),
      }),
    );

    const battle = new BattlePage(page);
    await expect(battle.hand).toHaveCount(MAX_HAND_SIZE);
    await expect(battle.hand.first()).toBeVisible();
    await expect(battle.hand.last()).toBeVisible();

    const layout = await page.evaluate(() => {
      const scene = document.querySelector<HTMLElement>('[data-testid="battle-scene"]');
      const stage = document.querySelector<HTMLElement>('[data-testid="vr-stage"]');
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[aria-label^="Play "]'));
      if (!scene || !stage) throw new Error("Battle layout roots are missing");

      const rect = (element: HTMLElement) => {
        const bounds = element.getBoundingClientRect();
        return { top: bounds.top, bottom: bounds.bottom };
      };

      return {
        sceneOverflow: getComputedStyle(scene).overflow,
        scene: rect(scene),
        stage: rect(stage),
        cards: cards.map(rect),
      };
    });

    expect(layout.sceneOverflow).toBe("visible");
    expect(layout.cards.some((card) => card.bottom > layout.scene.bottom + 0.5)).toBe(true);
    expect(Math.max(...layout.cards.map((card) => card.bottom))).toBeLessThanOrEqual(layout.stage.bottom + 1);
  });
});

test.describe("Talents", critical, () => {
  test.beforeEach(async ({ page }) => {
    await new MenuPage(page).gotoWithUnlockedMeta();
  });

  test("reset talents button is disabled when no talents are allocated", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.openTalents();

    const resetBtn = page.getByRole("button", { name: "Reset Talents" });
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toBeDisabled();
  });

  test("reset talents button opens confirmation after a talent is allocated", async ({ page }) => {
    await injectHomestead(page);
    await injectTalentUnlocks(page, { physical: ["physical-expert-blacksmith"] });
    await page.goto("/");

    const menu = new MenuPage(page);
    await menu.openTalents();

    const resetBtn = page.getByRole("button", { name: "Reset Talents" });
    await expect(resetBtn).toBeEnabled();

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

    await expect(page.locator(".hover-popup-panel[data-visible]")).toBeVisible();

    await battle.enemyArt.hover();
    await expect(page.locator(".hover-popup-panel[data-visible]")).toHaveCount(1);
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
    await expectRunPhase(page, "runLoop");

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
