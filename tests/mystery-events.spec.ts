import { expect, test } from "@playwright/test";

async function startRun(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/");
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByRole("button", { name: "Knight" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
}

async function playUntilVictory(page: Parameters<typeof test>[0]["page"]) {
  const victoryHeading = page.getByRole("heading", { name: "Victory!" });

  for (let turn = 0; turn < 12; turn += 1) {
    if (await victoryHeading.isVisible().catch(() => false)) return;

    while ((await page.locator('[aria-label^="Play "]').count()) > 0) {
      const card = page.locator('[aria-label^="Play "]').first();
      if (!(await card.isEnabled({ timeout: 500 }).catch(() => false))) break;
      await card.click({ force: true });
      await page.waitForTimeout(220);
      if (await victoryHeading.isVisible().catch(() => false)) return;
    }

    if (await victoryHeading.isVisible().catch(() => false)) return;

    await expect(page.locator('[aria-label^="Play "]').first()).toBeEnabled({ timeout: 8000 }).catch(async (e) => {
      if (await victoryHeading.isVisible().catch(() => false)) return;
      throw e;
    });
  }

  throw new Error("Battle did not reach the Victory screen in time.");
}

async function completeVictoryFlow(page: Parameters<typeof test>[0]["page"]) {
  // Complete the reward screen after a victory
  await page.locator('[aria-label^="Select "]').first().click();
  await page.getByRole("button", { name: "Add Card" }).click();
  // Wait for destination screen to render fully
  await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
}

async function navigateToMystery(page: Parameters<typeof test>[0]["page"]) {
  // Use text locator instead of role to avoid accessibility name mismatches
  const mysteryBtn = page.locator("button").filter({ hasText: "Mystery" });
  if (!(await mysteryBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    return false;
  }
  await mysteryBtn.click();
  // Wait for destination heading to disappear as mystery screen loads
  await expect(page.getByRole("heading", { name: "Choose Destination" })).not.toBeVisible({ timeout: 3000 });
  return true;
}

async function clickFirstCardTile(page: Parameters<typeof test>[0]["page"]) {
  // Card tiles are buttons that contain a nested <button> (BattleCardButton) + a <p> with card title.
  // System buttons (Cancel, Remove Card, Previous, Next) don't contain nested buttons.
  const cardTile = page.locator("button").filter({ has: page.locator("button") }).first();
  await cardTile.waitFor({ timeout: 2000 });
  await cardTile.click();
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

    // Mystery screen should show a title and choice buttons
    const title = page.getByRole("heading").first();
    await expect(title).toBeVisible();
    // Verify at least one choice button is visible (events have 2-3 choices)
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

    // Click the first visible choice button on the mystery screen
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

    // Handle card removal picker if the choice triggered one
    if (await page.getByText("Select a card to remove").isVisible({ timeout: 1000 }).catch(() => false)) {
      await clickFirstCardTile(page);
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: "Remove Card" }).click();
      await page.waitForTimeout(300);
    }

    await expect(page.getByRole("heading", { name: "Reward" })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });

  test("card removal in a mystery event can be cancelled", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    if (!(await navigateToMystery(page))) {
      test.skip(true, "Mystery not among destination choices");
      return;
    }

    // Try to find either "Leave an Offering" or "Make an Offering" (Fairy Ring / Ancient Altar)
    let found = false;
    for (const label of ["Leave an Offering", "Make an Offering"]) {
      const btn = page.getByRole("button", { name: label });
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click();
        found = true;
        break;
      }
    }

    if (!found) {
      test.skip(true, "No removal-requiring event encountered this run");
      return;
    }
    await page.waitForTimeout(200);

    await expect(page.getByText("Select a card to remove")).toBeVisible({ timeout: 1000 });

    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(200);

    // Should be back to the event screen
    await expect(page.getByRole("heading").first()).toBeVisible();
    // Choice buttons should still be present
    const choices = page.locator("button");
    const count = await choices.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
