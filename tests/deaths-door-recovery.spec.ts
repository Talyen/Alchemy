import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination } from "./helpers";

test.describe("Death's Door Recovery", () => {
  test("healing during Death's Door grace turn saves the player", async ({ page }) => {
    const BREAD = {
      id: "bread", title: "Bread", descriptionLines: ["Gain 5 Health", "Consume"],
      art: "placeholder", cost: 1, consume: true,
      effects: [{ kind: "heal" as const, amount: 5 }],
    };

    await injectSaveState(page, {
      runDeck: [BREAD, BREAD, BREAD, BREAD],
      runPlayerHealth: 1,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("button", { name: "Death's Door" })).toBeVisible({ timeout: 15000 });

    await page.locator('[aria-label="Play Bread"]').first().click();
    await page.waitForTimeout(300);

    await expect(page.getByRole("button", { name: "Death's Door" })).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled();
  });

  test("failing to heal during Death's Door leads to defeat", async ({ page }) => {
    await injectSaveState(page, {
      runPlayerHealth: 1,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("button", { name: "Death's Door" })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 15000 });
  });
});
