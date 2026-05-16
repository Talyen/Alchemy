import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination } from "./helpers";

test.describe("Wish Card", () => {
  test("playing wish card shows overlay with three choices", async ({ page }) => {
    const WISH = { id: "wish", title: "Wish", descriptionLines: ["Wish 1"], art: "placeholder", cost: 1, effects: [{ kind: "wish" as const, amount: 1 }] };
    await injectSaveState(page, {
      runDeck: [WISH, WISH, WISH, WISH],
      discoveredCardIds: ["wish"],
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await page.locator('[aria-label="Play Wish"]').first().click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Choose one card to add to your hand.")).toBeVisible();
    const wishChoices = page.locator('[aria-label^="Choose "]');
    await expect(wishChoices).toHaveCount(3);
  });

  test("corrupted wish with extra amount queues multiple wish selections", async ({ page }) => {
    const corruptedWish = {
      id: "wish", title: "Wish", art: "", cost: 1,
      descriptionLines: ["Wish"],
      corrupted: true,
      effects: [{ kind: "wish", amount: 2 }],
    };
    await injectSaveState(page, {
      runDeck: [corruptedWish, corruptedWish, corruptedWish, corruptedWish],
      discoveredCardIds: ["wish"],
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await page.locator('[aria-label="Play Wish"]').first().click();
    await page.waitForTimeout(400);

    await expect(page.getByText("Choose one card to add to your hand.")).toBeVisible();
    let wishChoices = page.locator('[aria-label^="Choose "]');
    await expect(wishChoices).toHaveCount(3);
    await wishChoices.first().click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.waitForTimeout(400);

    await expect(page.getByText("Choose one card to add to your hand.")).toBeVisible();
    wishChoices = page.locator('[aria-label^="Choose "]');
    await expect(wishChoices).toHaveCount(3);
    await wishChoices.first().click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.waitForTimeout(400);

    await expect(page.getByText("Choose one card to add to your hand.")).not.toBeVisible({ timeout: 2000 });
    await expect(page.locator('[aria-label^="Choose "]')).toHaveCount(0);
  });
});
