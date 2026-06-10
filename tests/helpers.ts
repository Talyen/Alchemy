import { expect, type Page } from "@playwright/test";
import { SAVE_KEY } from "@/lib/game-constants";
import {
  CURRENT_CONTENT_VERSION,
  CURRENT_GAME_BUILD_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
} from "@/lib/validation/metadata";
import { makeTestCard } from "./fixtures/cards";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { RewardPage } from "./pages/reward-page";

export { SAVE_KEY };

declare global {
  interface Window {
    disableForceDestination?: boolean;
  }
}

// Seeded PRNG (Linear Congruential Generator) for deterministic random behavior in tests.
export async function seedRandom(page: Page, seed = 42) {
  await page.addInitScript((s) => {
    let _seed = s;
    Math.random = () => {
      _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
      return _seed / 0x7fffffff;
    };
  }, seed);
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

function createMinimalLabyrinthMap(options?: { rows?: number; cols?: number }) {
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
    ...makeTestCard({
      id: "slash",
      title: "Slash",
      descriptionLines: ["Deal 6 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    }),
    ...overrides,
  };
}

export const BLOCK_CARD = { id: "block", title: "Block", descriptionLines: ["Gain 5 Block"], art: "placeholder", cost: 1, effects: [{ kind: "player-status", status: "block", amount: 5 }] };

export const AEGIS_CARD = { id: "blessed-aegis", title: "Blessed Aegis", descriptionLines: ["Deal Holy damage equal to your Block"], art: "placeholder", cost: 1, effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToBlock: true }] };

export const ANVIL_CARD = { id: "anvil", title: "Anvil", descriptionLines: ["Gain 1 Forge"], art: "placeholder", cost: 1, effects: [{ kind: "player-status", status: "forge", amount: 1 }] };

export const MANA_BERRIES_CARD = { id: "mana-berries", title: "Mana Berries", descriptionLines: ["Restore 2 Mana", "Consume"], art: "placeholder", cost: 1, consume: true, effects: [{ kind: "restore-mana", amount: 2 }] };

export function makeStatusCard(damageType: string, amount: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `test-${damageType}`, title: damageType.charAt(0).toUpperCase() + damageType.slice(1),
    descriptionLines: [`Deal ${amount} ${damageType} damage`],
    art: "placeholder", cost: 0,
    effects: [{ kind: "damage", damageType, amount }],
    ...overrides,
  };
}

export const WOLF_COMPANION_CARD = {
  id: "wolf-companion", title: "Wolf",
  descriptionLines: ["Summon a wolf ally"],
  art: "placeholder", cost: 1,
  effects: [{ kind: "summon-companion", companionId: "wolf" as const }],
};

export function makeHighDamageCard(amount = 500) {
  return {
    id: "boss-killer", title: "Boss Killer", descriptionLines: ["Deal massive damage"],
    art: "placeholder", cost: 0, effects: [{ kind: "damage" as const, damageType: "burn" as const, amount }],
  };
}

// Opens the mode picker from the main menu; game mode buttons live one screen past Play.
export async function openGameModeSelect(page: Page) {
  const adventureHeading = page.getByRole("heading", { name: "Choose Your Adventure" });
  if (await adventureHeading.isVisible()) return;

  const playButton = page.getByRole("button", { name: "Play", exact: true });
  await expect(playButton).toBeEnabled({ timeout: 15000 });

  // Mid-run saves can swap menu → destination during bootstrap; retry if Play detaches mid-click.
  await expect(async () => {
    await playButton.click();
    await expect(adventureHeading).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
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

/** Resume campaign when the menu flow is required, or wait if save bootstrap already opened destination. */
export async function resumeCampaignRun(page: Page) {
  const destination = page.getByRole("heading", { name: "Choose Destination" });
  if (await destination.isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }
  await resumeGameMode(page, "campaign");
  await expect(destination).toBeVisible({ timeout: 10000 });
}

// Injects a save state and navigates directly to the destination choice screen,
// bypassing the startRun + skipAndReward dance. Saves ~10s per test.
// The run lands with the given overrides applied to the default Knight run state.
const STARTING_DECK: Record<string, unknown>[] = [
  { id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"], art: "placeholder", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] },
  { id: "bash", title: "Bash", descriptionLines: ["Deal 4 Stun damage"], art: "placeholder", cost: 1, effects: [{ kind: "damage", damageType: "stun", amount: 4 }] },
  { id: "block", title: "Block", descriptionLines: ["Gain 5 Block"], art: "placeholder", cost: 1, effects: [{ kind: "player-status", status: "block", amount: 5 }] },
  { id: "anvil", title: "Anvil", descriptionLines: ["Gain 1 Forge"], art: "placeholder", cost: 1, effects: [{ kind: "player-status", status: "forge", amount: 1 }] },
  { id: "plate-mail", title: "Plate Mail", descriptionLines: ["Gain 2 Armor"], art: "placeholder", cost: 1, effects: [{ kind: "player-status", status: "armor", amount: 2 }] },
  { id: "bread", title: "Bread", descriptionLines: ["Gain 5 Health", "Consume"], art: "placeholder", cost: 1, consume: true, effects: [{ kind: "heal", amount: 5 }] },
];

async function forceNextDestinationChoice(page: Page, destination: DestinationName) {
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

export async function startAtDestination(
  page: Page,
  overrides: Record<string, unknown> = {},
  options: { forceDestination?: DestinationName } = {},
) {
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

type HomesteadSave = {
  saveSchemaVersion?: number;
  gameBuildVersion?: string;
  contentVersion?: number;
  selectedAspectRatio?: string;
  displayMode?: string;
  uiScale?: string;
  brightness?: number;
  musicVolume?: number;
  sfxVolume?: number;
  masterVolume?: number;
  muteInBackground?: boolean;
  autoEndTurn?: boolean;
  completedDifficulties?: Record<string, string[]>;
  activeRun?: null | Record<string, unknown>;
  materialInventory?: Record<string, number>;
  constructedBuildings?: Record<string, number>;
  plantedFarms?: Record<string, number>;
  completedResearch?: Record<string, number>;
  bondedCompanions?: Record<string, number>;
  discoveredCardIds?: string[];
  encounteredEnemyIds?: string[];
  discoveredTrinketIds?: string[];
  talentXP?: Record<string, number>;
  unlockedTalents?: Record<string, unknown>;
  finishedRunCharacters?: string[];
};

const BASE_HOMESTEAD_SAVE: HomesteadSave = {
  saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
  contentVersion: CURRENT_CONTENT_VERSION,
  selectedAspectRatio: "auto",
  displayMode: "borderless-fullscreen",
  uiScale: "100",
  brightness: 100,
  musicVolume: 50,
  sfxVolume: 50,
  masterVolume: 50,
  muteInBackground: true,
  autoEndTurn: true,
  completedDifficulties: { knight: [], rogue: [], wizard: [], ranger: [], alchemist: [], warlock: [], druid: [], wildcard: [] },
  finishedRunCharacters: ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"],
  activeRun: null,
  materialInventory: { wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 },
  constructedBuildings: { "blacksmiths-forge": 0, "hunters-lodge": 0, "alchemy-lab": 0, "runesmiths-workshop": 0, "companion-sanctuary": 0, "wishing-well": 0 },
  plantedFarms: { "wheat-field": 0, "herb-garden": 0, "chicken-coop": 0, "pasture": 0, "orchard": 0, "crystal-garden": 0 },
  completedResearch: { "carpentry": 0, "masonry": 0, "crop-rotation": 0, "animal-husbandry": 0, "fortified-walls": 0, "metallurgy": 0 },
  bondedCompanions: { "wolf": 0, "lizard-scout": 0, "imp": 0, "frost-whelp": 0, "bear": 0, "panther": 0, "phoenix": 0 },
  discoveredCardIds: ["slash"],
  encounteredEnemyIds: [],
  discoveredTrinketIds: [],
  talentXP: {},
  unlockedTalents: {},
};

export async function enableLoadingScreen(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("alchemy-skip-loading-screen");
  });
}

export async function injectTalentUnlocks(page: Page, unlockedTalents: Record<string, string[]>) {
  await page.addInitScript(({ saveKey, talents }) => {
    const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
    save.unlockedTalents = { ...(save.unlockedTalents || {}), ...talents };
    save.discoveredCardIds = save.discoveredCardIds || ["slash"];
    localStorage.setItem(saveKey, JSON.stringify(save));
  }, { saveKey: SAVE_KEY, talents: unlockedTalents });
}

export async function injectBossState(page: Page, act = 1) {
  const highDamageCard = makeHighDamageCard();
  await injectSaveState(page, {
    characterId: "knight",
    runDeck: Array.from({ length: 6 }, () => ({ ...highDamageCard })),
    roomsEncountered: 7,
    destinationIndexInAct: 7,
    currentAct: act,
    completedDestinations: Array.from({ length: 7 }, () => "Normal Combat"),
    runPlayerHealth: 30,
    runMaxHealth: 30,
  });
}

export async function injectHomestead(page: Page, overrides: Partial<HomesteadSave> = {}) {
  await page.addInitScript((data) => {
    localStorage.setItem(data.saveKey, JSON.stringify(data.save));
  }, { saveKey: SAVE_KEY, save: { ...BASE_HOMESTEAD_SAVE, ...overrides } });
}

export async function injectLabyrinthRun(
  page: Page,
  options: { runOverrides?: Record<string, unknown>; deck?: Record<string, unknown>[]; discoveredCardIds?: string[]; resume?: boolean } = {},
) {
  const map = createMinimalLabyrinthMap();
  await page.addInitScript((data) => {
    const save = JSON.parse(localStorage.getItem(data.saveKey) || "{}");
    save.activeRun = {
      characterId: "knight",
      runDeck: [],
      runGold: 0, runPlayerHealth: 30, runMaxHealth: 30, roomsEncountered: 0,
      currentAct: 1, destinationIndexInAct: 0, completedDestinations: [],
      runTrinkets: [], selectedDifficulty: null,
      contentSystemType: "labyrinth", labyrinthMap: data.map,
    };
    if (data.deck) save.activeRun.runDeck = data.deck;
    if (data.runOverrides) {
      Object.assign(save.activeRun, data.runOverrides);
    }
    save.discoveredCardIds = data.discoveredCardIds || ["slash"];
    if (!Array.isArray(save.finishedRunCharacters)) {
      save.finishedRunCharacters = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"];
    }
    localStorage.setItem(data.saveKey, JSON.stringify(save));
  }, { saveKey: SAVE_KEY, map, deck: options.deck ?? null, discoveredCardIds: options.discoveredCardIds ?? null, runOverrides: options.runOverrides ?? null });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled({ timeout: 5000 });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose Your Adventure" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /The Labyrinth/ }).click();
  if (options.resume) {
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Resume" }).click();
  }
}

export async function injectSaveState(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript((data) => {
    const save = JSON.parse(localStorage.getItem(data.saveKey) || "{}");
    const { discoveredCardIds, encounteredEnemyIds, discoveredTrinketIds, ...activeRunData } = data.payload;
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
    if (!Array.isArray(save.finishedRunCharacters)) {
      save.finishedRunCharacters = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"];
    }
    if (!Array.isArray(save.discoveredCardIds) || save.discoveredCardIds.length === 0) {
      save.discoveredCardIds = [
        "slash", "bash", "block", "anvil", "plate-mail", "apple", "meteor", "blessed-aegis",
      ];
    }
    localStorage.setItem(data.saveKey, JSON.stringify(save));
  }, { saveKey: SAVE_KEY, payload: overrides });
}

// Fresh run lands directly in the first forced Normal Combat battle.
// Novice difficulty is the default and skips the difficulty select screen for first-time players.
export async function startCampaignBattle(page: Page, character: "Knight" | "Ranger" | "Rogue" | "Wizard" = "Knight") {
  await seedRandom(page, 42);
  await page.goto("/");
  await selectGameMode(page, "campaign");
  await page.getByRole("button", { name: character }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
}

export async function skipBattleAndClaimReward(page: Page) {
  await new BattlePage(page).winViaCombat();
  await new RewardPage(page).claimFirstReward();
}



// Creates a deterministic battle by injecting a save with the given deck
// and navigating to the first combat. Skips the startRun UI dance entirely.
// Returns when the battle hand is visible.
export async function startBattleWithDeck(page: Page, deck: Record<string, unknown>[], overrides: Record<string, unknown> = {}) {
  await forceNextDestinationChoice(page, "Normal Combat");
  await injectSaveState(page, {
    runDeck: deck,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    ...overrides,
  });
  await page.goto("/");
  await resumeGameMode(page, "campaign");
  const destination = new DestinationPage(page);
  await destination.expectVisible();
  await destination.enterCombat("Normal Combat");
}
