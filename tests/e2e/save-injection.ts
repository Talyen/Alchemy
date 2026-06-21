// localStorage save injection for fast E2E bootstrap.
import { expect, type Page } from "@playwright/test";
import { SAVE_KEY } from "@/lib/game-constants";
import { baseHomesteadSave } from "../fixtures/saves";
import { makeHighDamageCard } from "./cards";

function createMinimalLabyrinthMap(options?: { rows?: number; cols?: number }) {
  const rows = options?.rows ?? 8;
  const cols = options?.cols ?? 9;
  const grid: ({
    type: string;
    modifiers: string[];
    rewardModifiers: string[];
    connections: { row: number; col: number }[];
    state: string;
  } | null)[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
  for (let r = 0; r < rows - 1; r++) {
    const col = Math.floor(cols / 2);
    grid[r][col] = {
      type: r === 0 ? "entrance" : "combat",
      modifiers: [],
      rewardModifiers: [],
      connections: [{ row: r + 1, col }],
      state: r === 0 ? "current" : r === 1 ? "visible" : "hidden",
    };
  }
  const lastCol = Math.floor(cols / 2);
  grid[rows - 1][lastCol] = {
    type: "boss",
    modifiers: [],
    rewardModifiers: [],
    connections: [{ row: rows - 2, col: lastCol }],
    state: "hidden",
  };
  return { grid, rows, cols, currentNode: { row: 0, col: Math.floor(cols / 2) } };
}

export async function injectSaveState(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript(
    (data) => {
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
        save.discoveredCardIds = ["slash", "bash", "block", "anvil", "plate-mail", "apple", "meteor", "blessed-aegis"];
      }
      localStorage.setItem(data.saveKey, JSON.stringify(save));
    },
    { saveKey: SAVE_KEY, payload: overrides },
  );
}

export async function injectHomestead(page: Page, overrides: Record<string, unknown> = {}) {
  const save = { ...baseHomesteadSave, ...overrides };
  if ("gearInventory" in overrides && overrides.gearInventory !== undefined) {
    save.saveSchemaVersion = 8;
  }
  await page.addInitScript(
    (data) => {
      localStorage.setItem(data.saveKey, JSON.stringify(data.save));
    },
    { saveKey: SAVE_KEY, save },
  );
}

export async function injectTalentUnlocks(page: Page, unlockedTalents: Record<string, string[]>) {
  await page.addInitScript(
    ({ saveKey, talents }) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      save.unlockedTalents = { ...(save.unlockedTalents || {}), ...talents };
      save.discoveredCardIds = save.discoveredCardIds || ["slash"];
      localStorage.setItem(saveKey, JSON.stringify(save));
    },
    { saveKey: SAVE_KEY, talents: unlockedTalents },
  );
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

export async function injectLabyrinthRun(
  page: Page,
  options: {
    runOverrides?: Record<string, unknown>;
    deck?: Record<string, unknown>[];
    discoveredCardIds?: string[];
    resume?: boolean;
  } = {},
) {
  const map = createMinimalLabyrinthMap();
  await page.addInitScript(
    (data) => {
      const save: Record<string, unknown> = {};
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
        selectedDifficulty: null,
        currentScreen: "labyrinth-map",
        contentSystemType: "labyrinth",
        labyrinthMap: data.map,
      };
      if (data.deck) (save.activeRun as Record<string, unknown>).runDeck = data.deck;
      if (data.runOverrides) {
        Object.assign(save.activeRun, data.runOverrides);
      }
      save.discoveredCardIds = data.discoveredCardIds || ["slash"];
      if (!Array.isArray(save.finishedRunCharacters)) {
        save.finishedRunCharacters = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"];
      }
      localStorage.setItem(data.saveKey, JSON.stringify(save));
    },
    {
      saveKey: SAVE_KEY,
      map,
      deck: options.deck ?? null,
      discoveredCardIds: options.discoveredCardIds ?? null,
      runOverrides: options.runOverrides ?? null,
    },
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Labyrinth|Map/i })).toBeVisible({ timeout: 20000 });
}

export async function enableLoadingScreen(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("alchemy-skip-loading-screen");
  });
}
