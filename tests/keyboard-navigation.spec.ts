import { expect, test } from "@playwright/test";
import { startCampaignBattle } from "./helpers";

test.describe("Keyboard Navigation", () => {
  test("escape opens and closes the in-battle menu", async ({ page }) => {
    await startCampaignBattle(page);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible({ timeout: 2000 });

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Main Menu" })).not.toBeVisible({ timeout: 2000 });
  });

  test("battle hamburger anchors menu near the trigger", async ({ page }) => {
    await startCampaignBattle(page);

    const trigger = page.getByRole("button", { name: "Open battle menu" });
    await trigger.click();
    const menu = page.getByTestId("game-menu");
    await expect(menu).toBeVisible({ timeout: 2000 });

    const triggerBox = await trigger.boundingBox();
    const menuBox = await menu.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    if (!triggerBox || !menuBox) return;

    const triggerRight = triggerBox.x + triggerBox.width;
    const menuRight = menuBox.x + menuBox.width;
    expect(Math.abs(menuRight - triggerRight)).toBeLessThan(80);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(triggerBox.y + 8);
  });

  test("focused card is playable with enter key", async ({ page }) => {
    await startCampaignBattle(page);

    const manaBefore = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));

    const firstCard = page.locator('[aria-label^="Play "]').first();
    await firstCard.focus();
    await expect(firstCard).toBeFocused();

    await page.keyboard.press("Enter");
    const manaAfter = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaAfter).toBeLessThan(manaBefore);
  });

  test("focus end turn and activate with enter", async ({ page }) => {
    await startCampaignBattle(page);

    const endTurn = page.getByRole("button", { name: "End Turn" });
    await endTurn.focus();
    await expect(endTurn).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(endTurn).toBeEnabled({ timeout: 8000 });
  });
});
