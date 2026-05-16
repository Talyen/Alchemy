import { expect, test } from "@playwright/test";
import { startRun } from "./helpers";

test.describe("Keyboard Navigation", () => {
  test("escape opens and closes the in-battle menu", async ({ page }) => {
    await startRun(page);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible({ timeout: 2000 });

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Main Menu" })).not.toBeVisible({ timeout: 2000 });
  });

  test("focused card is playable with enter key", async ({ page }) => {
    await startRun(page);

    const manaBefore = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));

    const firstCard = page.locator('[aria-label^="Play "]').first();
    await firstCard.focus();
    await expect(firstCard).toBeFocused();

    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    const manaAfter = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaAfter).toBeLessThan(manaBefore);
  });

  test("focus end turn and activate with enter", async ({ page }) => {
    await startRun(page);

    const endTurn = page.getByRole("button", { name: "End Turn" });
    await endTurn.focus();
    await expect(endTurn).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(endTurn).toBeEnabled({ timeout: 8000 });
  });
});
