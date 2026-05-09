import { expect, test } from "@playwright/test";
import { startRun, playUntilVictory, waitForEnemyTurn, completeVictoryFlow } from "./helpers";

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
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Resume Run" })).toBeVisible();
  });
});

test.describe("Character Select", () => {
  test("all characters are selectable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play" }).click();

    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Knight" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ranger" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rogue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wizard" })).toBeVisible();

    await page.getByRole("button", { name: "Rogue" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

    await page.getByRole("button", { name: "Wizard" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

    await page.getByRole("button", { name: "Ranger" }).click();
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
    const manaBefore = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));

    const playable = page.locator('[aria-label^="Play "]').first();
    await playable.click();
    await page.waitForTimeout(300);

    const manaAfter = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
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

    await waitForEnemyTurn(page);
    const hpAfterDamageText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpAfterDamage = Number(hpAfterDamageText?.split("/")[0]);
    if (hpAfterDamage >= 30) {
      test.skip(true, "Took no damage this turn");
      return;
    }

    const heal = page.getByRole("button", { name: /Play (Apple|Bread|Heal|Health Potion)/ });
    if (!(await heal.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "No heal card in hand after enemy turn");
      return;
    }
    await heal.click();
    await page.waitForTimeout(300);

    const hpAfterHealText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpAfterHeal = Number(hpAfterHealText?.split("/")[0]);
    expect(hpAfterHeal).toBeGreaterThan(hpAfterDamage);
  });

  test("anvil card grants forge status that persists across turns", async ({ page }) => {
    await startRun(page);

    const anvilCard = page.getByRole("button", { name: "Play Anvil" });
    if (!(await anvilCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Anvil card not in initial hand");
      return;
    }

    await anvilCard.click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: "Forge 1" })).toBeVisible();

    await waitForEnemyTurn(page);

    await expect(page.getByRole("button", { name: /Forge/ })).toHaveCount(1);
  });

  test("wolf companion appears and attacks on the next player turn", async ({ page }) => {
    await startRun(page, "Ranger");

    const wolfCard = page.getByRole("button", { name: "Play Wolf Companion" });
    if (!(await wolfCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Wolf Companion not in initial hand");
      return;
    }

    await wolfCard.click();
    await expect(page.getByTestId("active-companion")).toBeVisible();
    await expect(wolfCard).toHaveCount(0);

    await waitForEnemyTurn(page);

    await expect(page.getByRole("button", { name: "Bleed 2" })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Full Run Flow", () => {
  test("complete a victory run through destination choice", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    await page.getByRole("button", { name: /Combat/ }).first().click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });

  test("manual end run triggers game over screen", async ({ page }) => {
    await startRun(page);

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "End Run" }).click();

    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Return to Main Menu" })).toBeVisible();
  });

  test("game over screen shows talent progress and return to menu works", async ({ page }) => {
    await startRun(page);

    const playable = page.locator('[aria-label^="Play "]');
    const cardCount = await playable.count();
    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      await playable.nth(0).click();
      await page.waitForTimeout(200);
    }

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "End Run" }).click();

    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Talent Progress This Run")).toBeVisible();

    await page.getByRole("button", { name: "Return to Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });
});

test.describe("Options", () => {
  test("all three options tabs display correct content", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Options" }).click();

    await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
    await expect(page.getByLabel("Resolution")).toBeVisible();

    await page.getByRole("button", { name: "Sound" }).click();
    await expect(page.getByText("Music Volume")).toBeVisible();
    await expect(page.getByText("Sound Effects Volume")).toBeVisible();

    await page.getByRole("button", { name: "Other" }).click();
    await expect(page.getByText("Save Data", { exact: true })).toBeVisible();
    await expect(page.getByText("Clear Save Data", { exact: true })).toBeVisible();
  });

  test("options tabs are all clickable and show correct content", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Options" }).click();

    const displayBtn = page.getByRole("button", { name: "Display" });
    const soundBtn = page.getByRole("button", { name: "Sound" });
    const otherBtn = page.getByRole("button", { name: "Other" });

    await expect(displayBtn).toBeVisible();
    await expect(soundBtn).toBeVisible();
    await expect(otherBtn).toBeVisible();

    await soundBtn.click();
    await expect(page.getByText("Music Volume")).toBeVisible();

    await otherBtn.click();
    await expect(page.getByText("Save Data", { exact: true })).toBeVisible();

    await displayBtn.click();
    await expect(page.getByLabel("Resolution")).toBeVisible();
  });

  test("main menu and return to battle buttons in options", async ({ page }) => {
    await startRun(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Main Menu" }).click();

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
    await expect(page.getByText(/0 XP \/ 10 XP/)).toBeVisible();
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

    await page.getByRole("button", { name: "Physical" }).click();
    await expect(page.getByText("Undiscovered").first()).toBeVisible();
  });

  test("reset talents button is accessible from talent screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Talents" }).click();

    const resetBtn = page.getByRole("button", { name: "Reset Talents" });
    await expect(resetBtn).toBeVisible();

    await resetBtn.click();
    await expect(page.getByText("Reset Talents?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});

test.describe("Collection", () => {
  test("collection shows all three tabs with content and card inspection works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Collection" }).click();

    await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bestiary" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trinkets" })).toBeVisible();

    await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();

    const inspectBtn = page.getByRole("button", { name: /Inspect Slash/ });
    if (await inspectBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await inspectBtn.hover();
      await expect(page.getByText("Deal 5")).toBeVisible();
    }
  });

  test("collection tab navigation shows bestiary and trinket undiscovered entries", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Collection" }).click();

    await page.getByRole("button", { name: "Bestiary" }).click();
    await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Trinkets" }).click();
    await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Cards" }).click();
    await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();
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

  test("campfire screen restores HP and continues to next battle", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    const campfireBtn = page.getByRole("button", { name: "Campfire" });
    if (!(await campfireBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Campfire not among destination choices");
      return;
    }
    await campfireBtn.click();

    await expect(page.getByRole("button", { name: "Rest" })).toBeVisible();
    await page.getByRole("button", { name: "Rest" }).click();

    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Merchant's Shop", () => {
  test("shop renders with cards for sale, remove card, and refresh options", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    const shopBtn = page.getByRole("button", { name: "Merchant's Shop" });
    if (!(await shopBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Merchant's Shop not among destination choices");
      return;
    }
    await shopBtn.click();

    await expect(page.getByRole("heading", { name: "Merchant's Shop" })).toBeVisible();
    await expect(page.getByText(/Gold/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Buy for/ })).toHaveCount(3);
    await expect(page.getByRole("button", { name: /Remove Card/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Refresh/ })).toBeVisible();
  });

  test("leaving the shop navigates to destination choices", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    const shopBtn = page.getByRole("button", { name: "Merchant's Shop" });
    if (!(await shopBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Merchant's Shop not among destination choices");
      return;
    }
    await shopBtn.click();

    await page.getByRole("button", { name: "Leave Shop" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Alchemist's Shop", () => {
  test("alchemist hut renders with potions for sale, mix potions, and refresh options", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    const hutBtn = page.getByRole("button", { name: "Alchemist's Shop" });
    if (!(await hutBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Alchemist's Shop not among destination choices");
      return;
    }
    await hutBtn.click();

    await expect(page.getByRole("heading", { name: "Alchemist's Shop" })).toBeVisible();
    await expect(page.getByText(/Gold/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Buy for/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Mix Potions/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Refresh/ })).toBeVisible();
  });

  test("leaving the hut navigates to destination choices", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    const hutBtn = page.getByRole("button", { name: "Alchemist's Shop" });
    if (!(await hutBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Alchemist's Shop not among destination choices");
      return;
    }
    await hutBtn.click();

    await page.getByRole("button", { name: "Leave Hut" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
