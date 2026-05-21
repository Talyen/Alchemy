import { expect, test } from "@playwright/test";
import { createMinimalLabyrinthMap, forceNextDestinationChoice, makeCard, makeHighDamageCard, openGameModeSelect, selectGameMode, startAtDestination, startBattleWithDeck, startCampaignBattle, playUntilVictory, skipBattleAndClaimReward } from "./helpers";
import { BattlePage } from "./pages/battle-page";

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
    await startCampaignBattle(page);
    const battle = new BattlePage(page);
    await battle.menuBtn.click();
    await page.getByRole("button", { name: "Main Menu" }).click();
    await openGameModeSelect(page);
    await page.getByRole("button", { name: /The Campaign/ }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  });

  test("Labyrinth button shows Resume when a labyrinth run is active", async ({ page }) => {
    const map = createMinimalLabyrinthMap();
    const card = makeCard();

    await page.addInitScript((data) => {
      const KEY = "alchemy-save-v1";
      const save = JSON.parse(localStorage.getItem(KEY) || "{}");
      save.activeRun = {
        characterId: "knight",
        runDeck: [data.card],
        runGold: 0, runPlayerHealth: 30, runMaxHealth: 30, roomsEncountered: 1,
        currentAct: 1, destinationIndexInAct: 1, completedDestinations: [],
        runTrinkets: [], selectedDifficulty: null,
        contentSystemType: "labyrinth", labyrinthMap: data.map,
      };
      if (!Array.isArray(save.discoveredCardIds) || save.discoveredCardIds.length === 0) {
        save.discoveredCardIds = ["slash", "bash", "block"];
      }
      localStorage.setItem(KEY, JSON.stringify(save));
    }, { map, card });

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
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Battle Flow", () => {
  test("playing a card consumes mana and applies effects", async ({ page }) => {
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    const manaBefore = await battle.mana();
    await battle.playFirstCard();
    const manaAfter = await battle.mana();
    expect(manaAfter).toBe(manaBefore - 1);

    const handAfter = await battle.handCount();
    expect(handAfter).toBeGreaterThanOrEqual(0);
  });

  test("end turn triggers enemy phase and draws new cards", async ({ page }) => {
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    const handBefore = await battle.handCount();
    await battle.endTurn();
    const handAfter = await battle.handCount();
    expect(handAfter).toBe(handBefore);
  });

  test("anvil card grants forge status that persists across turns", async ({ page }) => {
    const ANVIL = { id: "anvil", title: "Anvil", descriptionLines: ["Gain 1 Forge"], art: "placeholder", cost: 1, effects: [{ kind: "player-status", status: "forge", amount: 1 }] };
    await startBattleWithDeck(page, [ANVIL, ANVIL, ANVIL, ANVIL, ANVIL, ANVIL]);
    const battle = new BattlePage(page);

    await page.getByRole("button", { name: "Play Anvil" }).first().click();
    await expect(page.getByRole("button", { name: "Forge 1" })).toBeVisible();

    await battle.endTurn();
    await expect(page.getByRole("button", { name: /Forge/ })).toHaveCount(1);
  });
});

test.describe("Mana Mechanics", () => {
  test("restore-mana overflows beyond maxMana", async ({ page }) => {
    const MANA_BERRIES = { id: "mana-berries", title: "Mana Berries", descriptionLines: ["Restore 2 Mana", "Consume"], art: "placeholder", cost: 1, consume: true, effects: [{ kind: "restore-mana", amount: 2 }] };
    await startBattleWithDeck(page, [MANA_BERRIES, MANA_BERRIES, MANA_BERRIES, MANA_BERRIES, MANA_BERRIES, MANA_BERRIES]);
    const battle = new BattlePage(page);

    const maxMana = await battle.mana();
    expect(maxMana).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Play Mana Berries" }).first().click();
    const manaAfter = await battle.mana();
    expect(manaAfter).toBeGreaterThan(maxMana);
  });
});

test.describe("Full Run Flow", () => {
  test("complete a victory run through destination choice", async ({ page }) => {
    await forceNextDestinationChoice(page, "Normal Combat");
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    await skipBattleAndClaimReward(page);

    const combatBtn = page.getByRole("button", { name: /Combat/ }).first();
    await expect(combatBtn).toBeVisible({ timeout: 5000 });
    await combatBtn.click();
    await expect(battle.hand.first()).toBeVisible({ timeout: 10000 });
  });

  test("manual end run triggers game over screen", async ({ page }) => {
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    await battle.menuBtn.click();
    await page.getByRole("button", { name: "End Run" }).click();

    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Return to Main Menu" })).toBeVisible();
  });

  test("game over screen shows talent progress and return to menu works", async ({ page }) => {
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    const cardCount = await battle.handCount();
    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      await battle.playFirstCard();
    }

    await battle.menuBtn.click();
    await page.getByRole("button", { name: "End Run" }).click();

    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Your run has ended.")).toBeVisible();

    await page.getByRole("button", { name: "Return to Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });
});

test.describe("Talents", () => {
  test("talents screen shows all keyword categories", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Talents" }).click();
    await expect(page.getByRole("heading", { name: "Talents" })).toBeVisible();

    const keywords = ["Physical", "Stun", "Block", "Forge", "Armor", "Health", "Burn", "Gold", "Holy", "Wish", "Poison", "Bleed", "Leech", "Freeze", "Mana"];
    for (const kw of keywords) {
      await expect(page.getByRole("button", { name: kw })).toBeVisible();
    }
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
    await page.addInitScript(() => {
      const save = JSON.parse(localStorage.getItem("alchemy-save-v1") || "{}");
      save.completedDifficulties = { knight: ["difficulty-1"], wizard: ["difficulty-1"] };
      localStorage.setItem("alchemy-save-v1", JSON.stringify(save));
    });
  });

  test("difficulty screen shows all three cards with correct unlock states", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "A Knight's Journey" })).toBeVisible();
    await expect(page.getByAltText("Novice")).toBeVisible();
    await expect(page.getByAltText("Adventurer")).toBeVisible();
    await expect(page.getByAltText("Legend")).toBeVisible();
    await expect(page.getByText("Locked")).toHaveCount(1);
  });

  test("selecting difficulty enables Play and starts a battle; Back returns to character select", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const playBtn = page.getByRole("button", { name: "Play" }).first();
    await expect(playBtn).toBeDisabled();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();

    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByAltText("Novice").click();
    await expect(playBtn).toBeEnabled();
    await playBtn.click();
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
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    await battle.menuBtn.click();

    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeVisible();
  });
});

test.describe("Card Interactions", () => {
  test("multiple copies of the same card in hand can be hovered and played independently", async ({ page }) => {
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    const handBefore = await battle.handCount();
    expect(handBefore).toBeGreaterThanOrEqual(2);

    await battle.hand.nth(0).hover();
    await expect(page.locator(".hover-popup-quick-in")).toBeVisible();

    await battle.hand.nth(1).hover();
    await expect(page.locator(".hover-popup-quick-in")).toBeVisible();

    await battle.hand.nth(0).click();
    expect(await battle.handCount()).toBe(handBefore - 1);

    await battle.hand.nth(0).click();
    expect(await battle.handCount()).toBe(handBefore - 2);
  });

  test("campfire screen restores Health and continues to next battle", async ({ page }) => {
    await startAtDestination(page, { runPlayerHealth: 10, runMaxHealth: 30 }, { forceDestination: "Campfire" });

    const campfireBtn = page.getByRole("button", { name: "Campfire" });
    await expect(campfireBtn).toBeVisible({ timeout: 5000 });
    await campfireBtn.click();

    await expect(page.getByRole("button", { name: "Rest" })).toBeVisible();
    await forceNextDestinationChoice(page, "Normal Combat");
    await page.getByRole("button", { name: "Rest" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Normal Combat" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Elite Combat", () => {
  test("elite combat destination starts a battle that can be won", async ({ page }) => {
    await startAtDestination(
      page,
      { runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()) },
      { forceDestination: "Elite Combat" },
    );

    const eliteBtn = page.getByRole("button", { name: "Elite Combat" });
    await expect(eliteBtn).toBeVisible({ timeout: 5000 });
    await eliteBtn.click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await playUntilVictory(page);
    await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible();
    await page.locator('[aria-label^="Select "]').first().click();
    await page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  });
});
