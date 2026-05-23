import { expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    disableForceDestination?: boolean;
  }
}

export const SAVE_KEY = "alchemy-save-v1";

// Seeded PRNG (Linear Congruential Generator) for deterministic random behavior in tests.
// Call via page.addInitScript(seedRandomScript(seed)) before page.goto.
export function seedRandomScript(seed = 42) {
  return `(() => {
    let _seed = ${seed};
    Math.random = () => {
      _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
      return _seed / 0x7fffffff;
    };
  })()`;
}

type GameMode = "campaign" | "labyrinth" | "wildwood";
type DestinationName =
  | "Normal Combat"
  | "Elite Combat"
  | "Merchant's Shop"
  | "Alchemist's Shop"
  | "Mystery"
  | "Corruption"
  | "Campfire";

const DESTINATION_RANDOM_VALUES: Record<DestinationName, number> = {
  "Normal Combat": 0,
  "Elite Combat": 0.2,
  "Merchant's Shop": 0.35,
  "Alchemist's Shop": 0.5,
  Mystery: 0.65,
  Corruption: 0.8,
  Campfire: 0.95,
};

const GAME_MODE_TITLES: Record<GameMode, string> = {
  campaign: "The Campaign",
  labyrinth: "The Labyrinth",
  wildwood: "The Wildwoods",
};

export function failOnRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    console.log("[Runtime Error]", error.message);
    errors.push(error.stack ?? error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.log("[Console Error]", message.text());
      errors.push(message.text());
    }
  });
  return errors;
}

export function createMinimalLabyrinthMap(options?: { rows?: number; cols?: number }) {
  const rows = options?.rows ?? 8;
  const cols = options?.cols ?? 9;
  const emptyRow = () => Array.from({ length: cols }, () => null);
  const grid = Array.from({ length: rows }, () => emptyRow());
  for (let r = 0; r < rows - 1; r++) {
    const col = Math.floor(cols / 2);
    grid[r][col] = {
      type: r === 0 ? "entrance" : "combat", modifiers: [], rewardModifiers: [],
      connections: [{ row: r + 1, col }],
      state: r === 0 ? "current" : r === 1 ? "visible" : "hidden",
    };
  }
  const lastCol = Math.floor(cols / 2);
  grid[rows - 1][lastCol] = {
    type: "boss", modifiers: [], rewardModifiers: [],
    connections: [{ row: rows - 2, col: lastCol }], state: "hidden",
  };
  return { grid, rows, cols, currentNode: { row: 0, col: Math.floor(cols / 2) } };
}

export function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"],
    art: "placeholder", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    ...overrides,
  };
}

export function makeHighDamageCard(amount = 500) {
  return {
    id: "boss-killer", title: "Boss Killer", descriptionLines: ["Deal massive damage"],
    art: "placeholder", cost: 0, effects: [{ kind: "damage" as const, damageType: "burn" as const, amount }],
  };
}

// Opens the mode picker from the main menu; game mode buttons live one screen past Play.
export async function openGameModeSelect(page: Page) {
  const playButton = page.getByRole("button", { name: "Play", exact: true });
  await expect(playButton).toBeEnabled({ timeout: 5000 });
  await playButton.click();
  await expect(page.getByRole("heading", { name: "Choose Your Adventure" })).toBeVisible({ timeout: 5000 });
}

// Selects a mode card and presses the footer action, which is Play for fresh runs
// and Resume when the selected mode has persisted progress.
export async function selectGameMode(page: Page, mode: GameMode, action: "Play" | "Resume" = "Play") {
  await openGameModeSelect(page);
  await page.getByRole("button", { name: new RegExp(GAME_MODE_TITLES[mode]) }).click();
  const actionButton = page.getByRole("button", { name: action, exact: true });
  await expect(actionButton).toBeEnabled({ timeout: 5000 });
  await actionButton.click();
}

export async function resumeGameMode(page: Page, mode: Exclude<GameMode, "wildwood"> = "campaign") {
  await selectGameMode(page, mode, "Resume");
}

// Injects a save state and navigates directly to the destination choice screen,
// bypassing the startRun + skipAndReward dance. Saves ~10s per test.
// The run lands with the given overrides applied to the default Knight run state.
export const STARTING_DECK: Record<string, unknown>[] = [
  { id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"], art: "placeholder", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] },
  { id: "bash", title: "Bash", descriptionLines: ["Deal 4 Stun damage"], art: "placeholder", cost: 1, effects: [{ kind: "damage", damageType: "stun", amount: 4 }] },
  { id: "block", title: "Block", descriptionLines: ["Gain 5 Block"], art: "placeholder", cost: 1, effects: [{ kind: "player-status", status: "block", amount: 5 }] },
  { id: "anvil", title: "Anvil", descriptionLines: ["Gain 1 Forge"], art: "placeholder", cost: 1, effects: [{ kind: "player-status", status: "forge", amount: 1 }] },
  { id: "plate-mail", title: "Plate Mail", descriptionLines: ["Gain 1 Armor"], art: "placeholder", cost: 1, effects: [{ kind: "player-status", status: "armor", amount: 1 }] },
  { id: "bread", title: "Bread", descriptionLines: ["Gain 5 Health", "Consume"], art: "placeholder", cost: 1, consume: true, effects: [{ kind: "heal", amount: 5 }] },
];

export async function forceNextDestinationChoice(page: Page, destination: DestinationName) {
  const randomValue = DESTINATION_RANDOM_VALUES[destination];
  await page.addInitScript((value) => {
    let seed = 42;
    window.disableForceDestination = false;
    Math.random = () => {
      if (window.disableForceDestination) {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
      }
      return value;
    };
  }, randomValue);
  await page.evaluate((value) => {
    let seed = 42;
    window.disableForceDestination = false;
    Math.random = () => {
      if (window.disableForceDestination) {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
      }
      return value;
    };
  }, randomValue);
}

export async function enableDevMode(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("alchemy-dev-mode", "true");
    } catch (e) {
      console.warn("Failed to set alchemy-dev-mode", e);
    }
  });
}

// Sets localStorage["alchemy-disable-animations"] before page load, collapsing all CSS
// animation/transition durations and JS setTimeout delays to 1ms. Speeds up battle-focused
// tests by ~3-6s per turn cycle by skipping card-flying animations, draw/discard sequencing,
// and phase delays (enemy action, attack recovery, companion follow-up).
// Do NOT use in tests that verify draw/discard animation behaviour (draw-discard-animations),
// layout/post-animation visual state (aspect-ratio-layout), or hover-popup timing.
export async function enableFastMode(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("alchemy-disable-animations", "true");
  });
}

export async function disableFastMode(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("alchemy-disable-animations");
  });
}

export async function startAtDestination(
  page: Page,
  overrides: Record<string, unknown> = {},
  options: { forceDestination?: DestinationName } = {},
) {
  await enableDevMode(page);
  if (options.forceDestination) await forceNextDestinationChoice(page, options.forceDestination);
  await injectSaveState(page, {
    runGold: 50,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    runDeck: STARTING_DECK,
    ...overrides,
  });
  await page.goto("/");
  await resumeGameMode(page, "campaign");
  await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  if (options.forceDestination) {
    await expect(page.getByRole("button", { name: options.forceDestination })).toBeVisible({ timeout: 3000 });
    await page.evaluate(() => {
      window.disableForceDestination = true;
    });
  }
}

export async function injectSaveState(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript((data) => {
    const KEY = "alchemy-save-v1";
    const save = JSON.parse(localStorage.getItem(KEY) || "{}");
    const { discoveredCardIds, encounteredEnemyIds, discoveredTrinketIds, ...activeRunData } = data;
    save.activeRun = {
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      ...activeRunData,
    };
    if (Array.isArray(discoveredCardIds)) save.discoveredCardIds = discoveredCardIds;
    if (Array.isArray(encounteredEnemyIds)) save.encounteredEnemyIds = encounteredEnemyIds;
    if (Array.isArray(discoveredTrinketIds)) save.discoveredTrinketIds = discoveredTrinketIds;
    if (!Array.isArray(save.discoveredCardIds) || save.discoveredCardIds.length === 0) {
      save.discoveredCardIds = [
        "slash", "bash", "block", "anvil", "plate-mail", "apple", "meteor", "blessed-aegis",
      ];
    }
    localStorage.setItem(KEY, JSON.stringify(save));
  }, overrides);
}

// Fresh run lands directly in the first forced Normal Combat battle.
// Novice difficulty is the default and skips the difficulty select screen for first-time players.
export async function startCampaignBattle(page: Page, character: "Knight" | "Ranger" | "Rogue" | "Wizard" = "Knight") {
  await enableDevMode(page);
  await page.addInitScript(seedRandomScript(42));
  await page.goto("/");
  await selectGameMode(page, "campaign");
  await page.getByRole("button", { name: character }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
}

export async function skipBattleAndClaimReward(page: Page) {
  await expect(page.getByRole("button", { name: "Skip Combat" })).toBeVisible({ timeout: 3000 });
  await page.getByRole("button", { name: "Skip Combat" }).click();
  await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible({ timeout: 3000 });
  await page.locator('[aria-label^="Select "]').first().click();
  const addBtn = page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ });
  await expect(addBtn).toBeEnabled({ timeout: 2000 });
  await addBtn.click();
}

// Cycles through destinations up to 10 attempts until the named destination is found.
// Intermediate combats are skipped via skipAndReward; non-combat destinations are
// advanced through automatically.
export async function navigateToDestination(page: Page, name: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const leaveButton = page.getByRole("button", { name: "Leave" });
    if (await leaveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await leaveButton.click();
    }
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
    const target = page.getByRole("button", { name });
    if (await target.isVisible({ timeout: 2000 }).catch(() => false)) {
      await target.click();
      return;
    }
    const combatBtn = page.getByRole("button", { name: /Combat/ }).first();
    if (await combatBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await combatBtn.click();
      await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
      await skipBattleAndClaimReward(page);
    } else {
      await page.getByRole("button").last().click();
      await expect(page.getByRole("heading", { name: /^(Choose Destination|Victory)/ }).or(page.getByRole("button", { name: "Leave" }))).toBeVisible({ timeout: 5000 });
      const leaveAfterEntry = page.getByRole("button", { name: "Leave" });
      if (await leaveAfterEntry.isVisible({ timeout: 3000 }).catch(() => false)) {
        await leaveAfterEntry.click();
        continue;
      }
      const cont = page.getByRole("button", { name: "Continue" });
      if (await cont.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cont.click();
        continue;
      }
      const skip = page.getByRole("button", { name: "Skip" });
      if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skip.click();
        continue;
      }
      const selectReward = page.locator('[aria-label^="Select "]').first();
      if (await selectReward.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectReward.click();
        const rewardConfirm = page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ }).first();
        await expect(rewardConfirm).toBeEnabled({ timeout: 3000 });
        await rewardConfirm.click();
        continue;
      }
      const choiceBtn = page.locator("button:not([disabled])").filter({ hasNotText: /Cancel|Menu|Remove Card|Previous|Next/ }).first();
      if (await choiceBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await choiceBtn.click();
        const confirmBtn = page.getByRole("button", { name: /Continue|Add Card|Remove Card/ }).first();
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(confirmBtn).toBeEnabled({ timeout: 3000 });
          await confirmBtn.click();
        }
      }
    }
  }
  throw new Error(`Could not find "${name}" in destination choices`);
}

export async function waitForEnemyTurn(page: Page) {
  const endTurnButton = page.getByRole("button", { name: "End Turn" });
  await endTurnButton.click();
  await expect(endTurnButton).toBeEnabled({ timeout: 7000 });
}

export async function playUntilVictory(page: Page) {
  const victoryHeading = page.getByRole("heading", { name: /^Victory/ });
  const endTurnButton = page.getByRole("button", { name: "End Turn" });

  for (let turn = 0; turn < 10; turn++) {
    if (await victoryHeading.isVisible().catch(() => false)) return;

    while ((await page.locator('[aria-label^="Play "]:visible').count()) > 0) {
      const card = page.locator('[aria-label^="Play "]:visible').first();
      if (!(await card.isEnabled({ timeout: 2000 }).catch(() => false))) break;
      await card.click({ force: true, timeout: 2000 }).catch(async (e) => {
        if (await victoryHeading.isVisible().catch(() => false)) return;
        throw e;
      });
      if (await victoryHeading.isVisible().catch(() => false)) return;
    }

    if (await victoryHeading.isVisible().catch(() => false)) return;

    await endTurnButton.click({ force: true }).catch(async (e) => {
      if (await victoryHeading.isVisible().catch(() => false)) return;
      throw e;
    });
    await expect(endTurnButton).toBeEnabled({ timeout: 7000 }).catch(async (e) => {
      if (await victoryHeading.isVisible().catch(() => false)) return;
      throw e;
    });
  }

  throw new Error("Battle did not reach the Victory screen in time.");
}

export async function completeVictoryFlow(page: Page) {
  await page.locator('[aria-label^="Select "]').first().click();
  await page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ }).click();
  await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
}

// Faster combat resolution — plays all cards aggressively with minimal delays.
// Skips victory checks between card plays for speed.
export async function quickWin(page: Page) {
  const endTurn = page.getByRole("button", { name: "End Turn" });
  const victoryHeading = page.getByRole("heading", { name: /^Victory/ });
  const hand = page.locator('[aria-label^="Play "]:visible');

  for (let turn = 0; turn < 10; turn++) {
    for (let i = 0; i < 8; i++) {
      const card = hand.first();
      if (!(await card.isVisible({ timeout: 2000 }).catch(() => false))) break;
      if (!(await card.isEnabled({ timeout: 2000 }).catch(() => false))) break;
      await card.click({ force: true });
    }

    if (await victoryHeading.isVisible().catch(() => false)) return;

    await endTurn.click();
    try {
      await expect(endTurn).toBeEnabled({ timeout: 7000 });
    } catch {
      if (!(await victoryHeading.isVisible().catch(() => false))) throw new Error("End Turn button not enabled and battle not over");
    }
  }
}

// Navigates to the first available Normal Combat destination (most common case).
// Faster than navigateToDestination for the simple "just get me into battle" case.
export async function navigateToCombat(page: Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
    const combatBtn = page.getByRole("button", { name: /Combat/ }).first();
    if (await combatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await combatBtn.click();
      return;
    }
    const leaveBtn = page.getByRole("button", { name: "Leave" });
    if (await leaveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await leaveBtn.click();
      continue;
    }
    const nonCombatBtn = page.getByRole("button").last();
    if (await nonCombatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nonCombatBtn.click();
    }
  }
  throw new Error("Could not find a Combat destination");
}

// Creates a deterministic battle by injecting a save with the given deck
// and navigating to the first combat. Skips the startRun UI dance entirely.
// Returns when the battle hand is visible.
export async function startBattleWithDeck(page: Page, deck: Record<string, unknown>[], overrides: Record<string, unknown> = {}) {
  await enableDevMode(page);
  await forceNextDestinationChoice(page, "Normal Combat");
  await injectSaveState(page, {
    runDeck: deck,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    ...overrides,
  });
  await page.goto("/");
  await resumeGameMode(page, "campaign");
  await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Normal Combat" }).click();
  await page.evaluate(() => { window.disableForceDestination = true; });
  await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
}
