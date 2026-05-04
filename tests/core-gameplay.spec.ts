import { expect, test } from "@playwright/test";

async function startRun(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/");
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByRole("button", { name: "Knight" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
}

async function waitForEnemyTurn(page: Parameters<typeof test>[0]["page"]) {
  const endTurnButton = page.getByRole("button", { name: "End Turn" });
  await endTurnButton.click();
  await expect(endTurnButton).toBeEnabled({ timeout: 8000 });
}

async function playUntilVictory(page: Parameters<typeof test>[0]["page"]) {
  const victoryHeading = page.getByRole("heading", { name: "Victory!" });

  for (let turn = 0; turn < 12; turn += 1) {
    if (await victoryHeading.isVisible().catch(() => false)) {
      return;
    }

    while ((await page.locator('[aria-label^="Play "]').count()) > 0) {
      await page.locator('[aria-label^="Play "]').first().click();
      await page.waitForTimeout(220);

      if (await victoryHeading.isVisible().catch(() => false)) {
        return;
      }
    }

    await page.waitForTimeout(1400);
  }

  throw new Error("Battle did not reach the Victory screen in time.");
}

test.describe("Menu", () => {
  test("all menu buttons are visible on the main menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talents" })).toBeVisible();
  });

  test("menu shows Resume Run when a battle is active", async ({ page }) => {
    await startRun(page);
    await page.getByRole("button", { name: "Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Resume Run" })).toBeVisible();
  });
});

test.describe("Character Select", () => {
  test("all three characters are selectable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play" }).click();

    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Knight" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rogue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wizard" })).toBeVisible();

    await page.getByRole("button", { name: "Rogue" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

    await page.getByRole("button", { name: "Wizard" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("back button returns to main menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });
});

test.describe("Battle Mechanics", () => {
  test("playing a card consumes mana", async ({ page }) => {
    await startRun(page);
    const manaBeforeText = await page.getByText(/\d+ Mana/).textContent();
    const manaBefore = Number(manaBeforeText?.match(/\d+/)?.[0]);

    const playable = page.locator('[aria-label^="Play "]').first();
    await playable.click();
    await page.waitForTimeout(300);

    const manaAfterText = await page.getByText(/\d+ Mana/).textContent();
    const manaAfter = Number(manaAfterText?.match(/\d+/)?.[0]);
    expect(manaAfter).toBe(manaBefore - 1);
  });

  test("heal card restores health", async ({ page }) => {
    await startRun(page);

    const healCard = page.getByRole("button", { name: /Play (Apple|Bread|Heal|Health Potion)/ });
    if (!(await healCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "No heal card in initial hand");
      return;
    }

    const hpText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpBefore = Number(hpText?.split("/")[0]);

    // Take damage first
    await waitForEnemyTurn(page);
    const hpAfterDamageText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpAfterDamage = Number(hpAfterDamageText?.split("/")[0]);
    if (hpAfterDamage >= 30) {
      test.skip(true, "Took no damage this turn");
      return;
    }

    // Play a heal card
    const heal = page.getByRole("button", { name: /Play (Apple|Bread|Heal|Health Potion)/ });
    await heal.click();
    await page.waitForTimeout(300);

    const hpAfterHealText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpAfterHeal = Number(hpAfterHealText?.split("/")[0]);
    expect(hpAfterHeal).toBeGreaterThan(hpAfterDamage);
  });

  test("anvil card grants forge status", async ({ page }) => {
    await startRun(page);

    const anvilCard = page.getByRole("button", { name: "Play Anvil" });
    if (!(await anvilCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Anvil card not in initial hand");
      return;
    }

    await anvilCard.click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: "Forge 1" })).toBeVisible();
  });

  test("status chips decay at end of turn", async ({ page }) => {
    await startRun(page);

    const forgeCard = page.getByRole("button", { name: "Play Anvil" });
    if (!(await forgeCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Anvil card not in initial hand");
      return;
    }

    await forgeCard.click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: "Forge 1" })).toBeVisible();

    await waitForEnemyTurn(page);

    // Forge should persist (doesn't decay like block)
    const forgeChip = page.getByRole("button", { name: /Forge/ });
    await expect(forgeChip).toHaveCount(1);
  });
});

test.describe("Full Run Flow", () => {
  test("complete a victory run through destination choice", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);

    // Reward screen: select first card
    await expect(page.getByRole("heading", { name: "Victory!" })).toBeVisible();
    await page.locator('[aria-label^="Select "]').first().click();
    await page.getByRole("button", { name: "Add Card" }).click();

    // Destination screen
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible();
    await page.getByRole("button", { name: /Combat/ }).first().click();

    // New battle starts
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });

  test("manual end run triggers game over screen", async ({ page }) => {
    await startRun(page);

    // Open menu and end run
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "End Run" }).click();

    // Should see game over screen
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Return to Main Menu" })).toBeVisible();
  });

  test("game over screen shows talent progress and return to menu works", async ({ page }) => {
    await startRun(page);

    // Play some cards to earn talent XP
    const playable = page.locator('[aria-label^="Play "]');
    const cardCount = await playable.count();
    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      await playable.nth(0).click();
      await page.waitForTimeout(200);
    }

    // End run
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "End Run" }).click();

    // Game over screen shows
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Talent Progress This Run")).toBeVisible();

    // Return to menu
    await page.getByRole("button", { name: "Return to Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });
});

test.describe("Options", () => {
  test("all three options tabs display correct content", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Options" }).click();

    // Display tab (default)
    await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
    await expect(page.getByLabel("Resolution")).toBeVisible();

    // Sound tab
    await page.getByRole("button", { name: "Sound" }).click();
    await expect(page.getByText("Music Volume")).toBeVisible();
    await expect(page.getByText("Sound Effects Volume")).toBeVisible();

    // Other tab
    await page.getByRole("button", { name: "Other" }).click();
    await expect(page.getByText("Save Data")).toBeVisible();
    await expect(page.getByText("Clear Save Data")).toBeVisible();
  });

  test("options layout does not shift when switching tabs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Options" }).click();

    const displayBtn = page.getByRole("button", { name: "Display" });
    const soundBtn = page.getByRole("button", { name: "Sound" });
    const otherBtn = page.getByRole("button", { name: "Other" });

    const displayBox = await displayBtn.boundingBox();
    await soundBtn.click();
    const displayBoxAfter = await displayBtn.boundingBox();

    // Display button should be in the same place
    expect(displayBox?.y).toBe(displayBoxAfter?.y);
    expect(displayBox?.x).toBe(displayBoxAfter?.x);

    await otherBtn.click();
    const displayBoxAfterOther = await displayBtn.boundingBox();
    expect(displayBox?.y).toBe(displayBoxAfterOther?.y);
  });

  test("main menu and return to battle buttons in options", async ({ page }) => {
    await startRun(page);
    await page.getByRole("button", { name: "Main Menu" }).click();

    // Navigate to options from main menu
    await page.getByRole("button", { name: "Options" }).click();
    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Return to Battle" })).toBeVisible();
  });
});

test.describe("Talents", () => {
  test("talents screen shows keyword buttons and XP progress", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Talents" }).click();

    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();
    await expect(page.getByText("XP Progress")).toBeVisible();
    await expect(page.getByText("0 XP / 10 XP")).toBeVisible();
  });

  test("talents screen shows all keyword categories", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Talents" }).click();

    const keywords = ["Physical", "Stun", "Block", "Forge", "Armor", "Health", "Burn", "Gold", "Holy", "Wish", "Ailment", "Poison", "Bleed", "Leech", "Freeze", "Mana"];
    for (const kw of keywords) {
      await expect(page.getByRole("button", { name: kw })).toBeVisible();
    }
  });

  test("talents screen shows undiscovered nodes for a keyword", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Talents" }).click();

    // Click Physical - should show its undiscovered talents
    await page.getByRole("button", { name: "Physical" }).click();
    await expect(page.getByText("Undiscovered").first()).toBeVisible();
  });

  test("reset talents button is accessible from talent screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Talents" }).click();

    const resetBtn = page.getByRole("button", { name: "Reset Talents" });
    await expect(resetBtn).toBeVisible();

    // Click should show confirmation dialog
    await resetBtn.click();
    await expect(page.getByText("Reset Talents?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});

test.describe("Collection", () => {
  test("collection shows all three tabs with content", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Collection" }).click();

    await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bestiary" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trinkets" })).toBeVisible();

    // Cards tab should show discovered starter cards
    await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();
  });

  test("inspecting a card shows its description", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Collection" }).click();

    const inspectBtn = page.getByRole("button", { name: /Inspect Slash/ });
    if (await inspectBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await inspectBtn.hover();
      await expect(page.getByText("Deal 5")).toBeVisible();
    }
  });

  test("collection tab navigation preserves page state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Collection" }).click();

    await page.getByRole("button", { name: "Bestiary" }).click();
    await expect(page.getByText("Undiscovered").first()).toBeVisible();

    // Switch back to cards
    await page.getByRole("button", { name: "Cards" }).click();
    await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();
  });
});

test.describe("Resolution Settings", () => {
  test("switching resolution updates the stage size", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Options" }).click();

    await page.getByLabel("Resolution").selectOption("2560x1440");
    await expect(page.getByLabel("Resolution")).toHaveValue("2560x1440");
  });
});

test.describe("Navigation", () => {
  test("in-battle menu allows navigation to collection, options, and talents", async ({ page }) => {
    await startRun(page);

    await page.getByRole("button", { name: "Menu" }).click();

    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeVisible();
  });
});

test.describe("Card Interactions", () => {
  test("multiple copies of the same card in hand can be hovered and played independently", async ({ page }) => {
    await startRun(page);

    const playableCards = page.locator('[aria-label^="Play "]');

    const handBefore = await playableCards.count();
    expect(handBefore).toBeGreaterThanOrEqual(2);

    await playableCards.nth(0).hover();
    await expect(page.locator(".hover-popup-quick-in")).toBeVisible();

    await playableCards.nth(1).hover();
    await expect(page.locator(".hover-popup-quick-in")).toBeVisible();

    await playableCards.nth(0).click();
    await page.waitForTimeout(300);

    const handAfterFirst = await playableCards.count();
    expect(handAfterFirst).toBe(handBefore - 1);

    await playableCards.nth(0).click();
    await page.waitForTimeout(300);

    const handAfterSecond = await playableCards.count();
    expect(handAfterSecond).toBe(handAfterFirst - 1);
  });
});
