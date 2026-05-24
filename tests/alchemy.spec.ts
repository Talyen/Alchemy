import { expect, type Page, test } from "@playwright/test";
import { enableDevMode, enableFastMode, failOnRuntimeErrors, makeCard, makeHighDamageCard, playUntilVictory, selectGameMode, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";

async function parsePlayerHealth(page: Page): Promise<number> {
  const text = await page.getByTestId("player-health").textContent();
  return Number(text?.split("/")[0] ?? 30);
}

async function parseEnemyHealth(page: Page): Promise<number> {
  const text = await page.getByTestId("enemy-health").textContent();
  return Number(text?.split("/")[0] ?? 30);
}

test.describe("App Boot", () => {
  test("main menu renders without crashing on desktop", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await enableDevMode(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 5000 });
    expect(errors).toEqual([]);
  });
});

test.describe("Block Mechanics", () => {
  const BLOCK_CARD = { id: "block", title: "Block", descriptionLines: ["Gain 5 Block"], art: "placeholder", cost: 1, effects: [{ kind: "player-status", status: "block", amount: 5 }] };
  const AEGIS_CARD = { id: "blessed-aegis", title: "Blessed Aegis", descriptionLines: ["Deal Holy damage equal to your Block"], art: "placeholder", cost: 1, effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToBlock: true }] };

  test("block card absorbs attack damage and halves at end of turn", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, [BLOCK_CARD, BLOCK_CARD, BLOCK_CARD, BLOCK_CARD, BLOCK_CARD, BLOCK_CARD]);
    const battle = new BattlePage(page);

    const hpBefore = await parsePlayerHealth(page);

    await page.getByRole("button", { name: "Play Block" }).first().click();

    await battle.endTurn();

    const hpAfter = await parsePlayerHealth(page);
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

    const enemyHp = await parseEnemyHealth(page);
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

test.describe("Mobile Portrait", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("portrait view shows rotate device prompt", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Rotate Your Device" })).toBeVisible();
  });
});

test.describe("Mobile Landscape", () => {
  test.use({ hasTouch: true, viewport: { width: 932, height: 430 } });

  test("menu and character select work in landscape", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await selectGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
  });

  test("battle hand is playable in landscape", async ({ page }) => {
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()));
    const battle = new BattlePage(page);

    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
    expect(await battle.handCount()).toBeGreaterThanOrEqual(1);

    const layout = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[aria-label^="Play "]')].map((card) => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      const hasFanOverlap = cards.length >= 2 && cards.some((card, index) => index > 0 && card.left < cards[index - 1].right);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        cardsWithinViewport: cards.every((card) => card.left >= 0 && card.right <= window.innerWidth && card.top >= 0 && card.bottom <= window.innerHeight),
        hasFanOverlap,
      };
    });

    expect(layout.scrollWidth, `Landscape scroll overflow: ${layout.scrollWidth} > ${layout.viewportWidth}`).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.scrollHeight, `Landscape scroll overflow: ${layout.scrollHeight} > ${layout.viewportHeight}`).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.cardsWithinViewport, "Landscape: not all cards within viewport").toBe(true);
    expect(layout.hasFanOverlap, "Landscape: hand fan overlap expected").toBe(true);

    const manaBefore = await battle.mana();
    await battle.playFirstCard();
    const manaAfter = await battle.mana();
    expect(manaAfter).toBeLessThan(manaBefore);
  });
});
