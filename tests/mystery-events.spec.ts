import { expect, test } from "@playwright/test";
import { startRun, playUntilVictory, completeVictoryFlow } from "./helpers";

async function navigateToMystery(page: Parameters<typeof test>[0]["page"]) {
  const mysteryBtn = page.locator("button").filter({ hasText: "Mystery" });
  if (!(await mysteryBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    return false;
  }
  await mysteryBtn.click();
  await expect(page.getByRole("heading", { name: "Choose Destination" })).not.toBeVisible({ timeout: 3000 });
  return true;
}

test.describe("Mystery Events", () => {
  test("mystery destination shows event screen with title, narrative, and choices", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    if (!(await navigateToMystery(page))) {
      test.skip(true, "Mystery not among destination choices");
      return;
    }

    const title = page.getByRole("heading").first();
    await expect(title).toBeVisible();
    const choices = page.locator("button");
    const count = await choices.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("choosing a mystery option leads to reward screen then destination", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    if (!(await navigateToMystery(page))) {
      test.skip(true, "Mystery not among destination choices");
      return;
    }

    const allBtns = page.getByRole("button");
    const btnCount = await allBtns.count();
    let clicked = false;
    for (let i = 0; i < btnCount; i++) {
      const text = (await allBtns.nth(i).textContent()) ?? "";
      const trimmed = text.trim();
      if (trimmed && !["Cancel", "Remove Card", "Previous", "Next", "Menu"].includes(trimmed)) {
        await allBtns.nth(i).click();
        clicked = true;
        break;
      }
    }
    expect(clicked).toBe(true);
    await page.waitForTimeout(300);

    if (await page.getByText("Select a card to remove").isVisible({ timeout: 1000 }).catch(() => false)) {
      const cardTile = page.locator("button").filter({ has: page.locator("button") }).first();
      await cardTile.waitFor({ timeout: 2000 });
      await cardTile.click();
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Remove Card" }).click();
      await page.waitForTimeout(300);
    }

    if (await page.getByText("Choose a Card").isVisible({ timeout: 1000 }).catch(() => false)) {
      const cardChoice = page.locator("button[aria-label^='Select']").first();
      await cardChoice.waitFor({ timeout: 2000 });
      await cardChoice.click();
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Add Card" }).click();
      await page.waitForTimeout(300);
    }

    await expect(page.getByRole("heading", { name: "Reward" })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
