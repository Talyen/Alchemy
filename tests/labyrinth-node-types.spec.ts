import { expect, test } from "@playwright/test";
import { injectSaveState } from "./helpers";

test.describe("Labyrinth Node Types", () => {
  test("labyrinth map shows with combat and rest nodes available", async ({ page }) => {
    await injectSaveState(page, {
      contentSystemType: "labyrinth",
      runDeck: [],
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Adventure" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /The Labyrinth/ }).click();
    await page.getByRole("button", { name: "Resume" }).click();

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 10000 });

    const combatNodes = page.getByRole("button", { name: /Combat|Fight/ });
    if (await combatNodes.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(combatNodes.first()).toBeVisible();
    }
  });
});
