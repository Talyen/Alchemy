import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination, startRun } from "./helpers";

test.describe("Wish Card", () => {
  test("playing wish card shows overlay with three choices", async ({ page }) => {
    await startRun(page);

    const wishCard = page.getByRole("button", { name: /Play Wish/ });
    if (!(await wishCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Wish card not in initial hand");
      return;
    }

    await wishCard.click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Choose one card to add to your hand.")).toBeVisible();
    const wishChoices = page.locator('[aria-label^="Choose "]');
    await expect(wishChoices).toHaveCount(3);
  });

  test("corrupted wish with extra amount queues multiple wish selections", async ({ page }) => {
    test.setTimeout(60000);
    const corruptedWish = {
      id: "wish", title: "Wish", art: "", cost: 1,
      descriptionLines: ["Wish"],
      corrupted: true,
      effects: [{ kind: "wish", amount: 2 }],
    };
    await injectSaveState(page, {
      runDeck: [corruptedWish, corruptedWish, corruptedWish],
      discoveredCardIds: ["wish"],
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");

    const wishCard = page.getByRole("button", { name: /Play Wish/ });
    if (!(await wishCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Wish card not in initial hand");
      return;
    }

    await wishCard.click();
    await page.waitForTimeout(400);

    await expect(page.getByText("Choose one card to add to your hand.")).toBeVisible();

    // First wish batch: pick a card and confirm
    let wishChoices = page.locator('[aria-label^="Choose "]');
    await expect(wishChoices).toHaveCount(3);
    await wishChoices.first().click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.waitForTimeout(400);

    // Second wish batch should appear from the queue
    await expect(page.getByText("Choose one card to add to your hand.")).toBeVisible();
    wishChoices = page.locator('[aria-label^="Choose "]');
    await expect(wishChoices).toHaveCount(3);
    await wishChoices.first().click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.waitForTimeout(400);

    // Wish overlay should now be gone
    await expect(page.getByText("Choose one card to add to your hand.")).not.toBeVisible({ timeout: 2000 });
    await expect(page.locator('[aria-label^="Choose "]')).toHaveCount(0);
  });
});
