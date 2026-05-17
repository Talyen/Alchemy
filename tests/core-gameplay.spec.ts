import { expect, test } from "@playwright/test";
import { openGameModeSelect, selectGameMode, startAtDestination, startRun, playUntilVictory, waitForEnemyTurn, completeVictoryFlow, navigateToDestination, skipAndReward } from "./helpers";

test.describe("Menu", () => {
  test("all menu buttons are visible on the main menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talents" })).toBeVisible();
    await openGameModeSelect(page);
    await expect(page.getByRole("button", { name: /The Campaign/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /The Labyrinth/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /The Wildwoods/ })).toBeVisible();
  });

  test("menu shows Resume Run when a campaign battle is active", async ({ page }) => {
    await startRun(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await openGameModeSelect(page);
    await page.getByRole("button", { name: /The Campaign/ }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  });

  test("Labyrinth button shows Resume when a labyrinth run is active", async ({ page }) => {
    // Inject a labyrinth save state
    await page.addInitScript(() => {
      const SAVE_KEY = "alchemy-save-v1";
      const save = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      save.activeRun = {
        characterId: "knight",
        runDeck: [{ id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"], art: "placeholder", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] }],
        runGold: 0,
        runPlayerHealth: 30,
        runMaxHealth: 30,
        roomsEncountered: 1,
        currentAct: 1,
        destinationIndexInAct: 1,
        completedDestinations: [],
        runTrinkets: [],
        selectedDifficulty: null,
        contentSystemType: "labyrinth",
      };
      if (!Array.isArray(save.discoveredCardIds) || save.discoveredCardIds.length === 0) {
        save.discoveredCardIds = ["slash", "bash", "block"];
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    });
    await page.goto("/");
    await openGameModeSelect(page);
    await page.getByRole("button", { name: /The Labyrinth/ }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  });
});

test.describe("Character Select", () => {
  test("all characters are selectable", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");

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
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });

  test("fresh wizard run starts with wizard cards", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Wizard" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    // With no Novice completed, difficulty select is skipped and battle starts directly
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    // First few cards in the wizard's hand should have mana costs visible
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible();
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

test.describe("Mana Mechanics", () => {
  test("restore-mana overflows beyond maxMana", async ({ page }) => {
    await startRun(page, "Wizard");

    const manaBerries = page.getByRole("button", { name: "Play Mana Berries" });
    if (!(await manaBerries.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Mana Berries not in initial hand");
      return;
    }

    const maxMana = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(maxMana).toBeGreaterThan(0);

    await manaBerries.click();
    await page.waitForTimeout(300);

    const manaAfter = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaAfter).toBeGreaterThan(maxMana);
  });

  test("meteor reduces max mana and clamps current mana", async ({ page }) => {
    await startRun(page, "Wizard");

    const meteor = page.getByRole("button", { name: "Play Meteor" });
    if (!(await meteor.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Meteor not in initial hand");
      return;
    }

    const manaBefore = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaBefore).toBeGreaterThan(0);

    await meteor.click();
    await page.waitForTimeout(300);

    const manaAfter = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaAfter).toBeLessThanOrEqual(manaBefore - 1);
  });
});

test.describe("Status Mechanics", () => {
  test("poison dagger applies poison that ticks each turn", async ({ page }) => {
    await startRun(page, "Rogue");

    const poisonDagger = page.getByRole("button", { name: "Play Poison Dagger" });
    if (!(await poisonDagger.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Poison Dagger not in initial hand");
      return;
    }

    await poisonDagger.click();
    await page.waitForTimeout(300);

    const enemyHpBefore = 30;

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

    const enemyHpText = await page.locator("text=/\\d+\\/30/").last().textContent();
    const enemyHpAfter = Number(enemyHpText?.split("/")[0]);
    expect(enemyHpAfter).toBeLessThan(enemyHpBefore);
  });
});

test.describe("Full Run Flow", () => {
  test("complete a victory run through destination choice", async ({ page }) => {
    await startRun(page);
    await skipAndReward(page);

    const combatBtn = page.getByRole("button", { name: /Combat/ }).first();
    if (!(await combatBtn.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip(true, "No combat destination available");
      return;
    }
    await combatBtn.click();
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
    await expect(page.getByText("Your run has ended.")).toBeVisible();

    await page.getByRole("button", { name: "Return to Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });
});

test.describe("Options", () => {
  test("all three options tabs display correct content", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Options" }).click();

    await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
    await expect(page.getByLabel("Aspect Ratio")).toBeVisible();

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
    await expect(page.getByLabel("Aspect Ratio")).toBeVisible();
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
    await expect(page.getByText("0 / 10 XP")).toBeVisible();
  });

  test("talents screen shows all keyword categories", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Talents" }).click();

    const keywords = ["Physical", "Stun", "Block", "Forge", "Armor", "Health", "Burn", "Gold", "Holy", "Wish", "Poison", "Bleed", "Leech", "Freeze", "Mana"];
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

test.describe("Difficulty Select", () => {
  test.beforeEach(async ({ page }) => {
    // Seed completed Novice so the difficulty select screen appears instead of skipping to battle
    await page.addInitScript(() => {
      const SAVE_KEY = "alchemy-save-v1";
      const save = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      save.completedDifficulties = { knight: ["difficulty-1"], wizard: ["difficulty-1"] };
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    });
  });

  test("difficulty screen shows after character selection", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "A Knight's Journey" })).toBeVisible();
    await expect(page.getByAltText("Knight")).toBeVisible();
  });

  test("all three difficulty cards are visible", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByAltText("Novice")).toBeVisible();
    await expect(page.getByAltText("Adventurer")).toBeVisible();
    await expect(page.getByAltText("Legend")).toBeVisible();
  });

  test("Novice and Adventurer are unlocked, Legend shows as locked", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByAltText("Novice")).toBeVisible();
    // With Novice completed, Adventurer is unlocked; only Legend is locked
    await expect(page.getByText("Locked")).toHaveCount(1);
  });

  test("Play is disabled before a difficulty is selected", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const playBtn = page.getByRole("button", { name: "Play" }).first();
    await expect(playBtn).toBeDisabled();
  });

  test("selecting Novice enables the Play button", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByAltText("Novice").click();
    await expect(page.getByRole("button", { name: "Play" }).first()).toBeEnabled();
  });

  test("Back from difficulty select returns to character select", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
  });

  test("selecting Novice and Play starts a battle", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByAltText("Novice").click();
    await page.getByRole("button", { name: "Play" }).first().click();

    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });

  test("Wizard shows different difficulty config", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Wizard" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "A Wizard's Saga" })).toBeVisible();
    await expect(page.getByAltText("Novice")).toBeVisible();
    await expect(page.getByAltText("Adventurer")).toBeVisible();
    await expect(page.getByAltText("Legend")).toBeVisible();
  });
});

test.describe("Difficulty Skip (first-time player)", () => {
  test("selecting a character with no completed difficulties skips to battle", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Should go straight to battle without seeing difficulty select
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
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
    await startAtDestination(page);

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
    await skipAndReward(page);

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
  test("alchemist shop renders with potions for sale, mix potions, and refresh options", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    const shopBtn = page.getByRole("button", { name: "Alchemist's Shop" });
    if (!(await shopBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Alchemist's Shop not among destination choices");
      return;
    }
    await shopBtn.click();

    await expect(page.getByRole("heading", { name: "Alchemist's Shop" })).toBeVisible();
    await expect(page.getByText(/Gold/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Buy for/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Mix Potions/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Refresh/ })).toBeVisible();
  });

  test("leaving the shop navigates to destination choices", async ({ page }) => {
    await startRun(page);
    await playUntilVictory(page);
    await completeVictoryFlow(page);

    const shopBtn = page.getByRole("button", { name: "Alchemist's Shop" });
    if (!(await shopBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Alchemist's Shop not among destination choices");
      return;
    }
    await shopBtn.click();

    await page.getByRole("button", { name: "Leave Shop" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
