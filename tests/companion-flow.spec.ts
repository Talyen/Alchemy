import { expect, test } from "@playwright/test";
import { enableFastMode, failOnRuntimeErrors, startBattleWithDeck, WOLF_COMPANION_CARD } from "./helpers";
import { BattlePage } from "./pages/battle-page";

test.describe("Companion Battle Behavior", () => {
  test.describe.configure({ mode: "serial" });
  const COMPANION_DECK = Array.from({ length: 6 }, () => WOLF_COMPANION_CARD);

  test("summon companion card places companion in battle panel", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await enableFastMode(page);
    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await page.getByRole("button", { name: "Play Wolf" }).first().click();
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });
    await expect(battle.companionPanel).toHaveAttribute("aria-label", "Active companion: Wolf Companion");
    expect(errors).toEqual([]);
  });

  test("companion auto-attacks at start of owner turn", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await enableFastMode(page);
    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await page.getByRole("button", { name: "Play Wolf" }).first().click();
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });

    const enemyHpBefore = await battle.enemyHealth();
    await battle.endTurn();

    await expect(async () => {
      expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
    }).toPass({ timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test("companion persists across multiple turns", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await enableFastMode(page);
    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await page.getByRole("button", { name: "Play Wolf" }).first().click();
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });

    await battle.endTurn();
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });

    if (await battle.handCount() > 0) {
      await battle.hand.first().click().catch(() => {});
    }
    await battle.endTurn();
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });
    expect(errors).toEqual([]);
  });
});
