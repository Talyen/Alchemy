import { expect } from "@playwright/test";
import { makeCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";

test.describe("Keyboard Navigation", critical, () => {
  test("keyboard controls and hotkeys work in combat", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);

    // 1. Escape opens and closes the in-battle menu
    await page.keyboard.press("Escape");
    const mainMenuBtn = page.getByRole("button", { name: "Main Menu" });
    await expect(mainMenuBtn).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(mainMenuBtn).toBeHidden({ timeout: 3000 });

    // 2. Battle hamburger anchors menu near the trigger
    const trigger = page.getByRole("button", { name: "Open battle menu" });
    await trigger.click();
    const menu = page.getByTestId("game-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });

    const triggerBox = await trigger.boundingBox();
    const menuBox = await menu.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    if (triggerBox && menuBox) {
      const triggerRight = triggerBox.x + triggerBox.width;
      const menuRight = menuBox.x + menuBox.width;
      expect(Math.abs(menuRight - triggerRight)).toBeLessThan(80);
      expect(menuBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height - 8);
    }

    // Close menu to resume play
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden({ timeout: 3000 });

    // 3. Focused card is playable with enter key
    const manaBefore = await battle.mana();
    const firstCard = battle.hand.first();
    await firstCard.focus();
    await expect(firstCard).toBeFocused();

    await page.keyboard.press("Enter");
    const manaAfter = await battle.mana();
    expect(manaAfter).toBeLessThan(manaBefore);

    // 4. Focus end turn and activate with enter
    await battle.endTurnBtn.focus();
    await expect(battle.endTurnBtn).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(battle.endTurnBtn).toBeEnabled({ timeout: 5000 });
  });
});
