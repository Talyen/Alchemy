// localStorage save injection for fast E2E bootstrap.
// Desktop (Electron) boots from the native save bridge — write there and reload instead.
import { expect, type Page } from "@playwright/test";
import { SAVE_KEY } from "@/lib/game-constants";
import { baseHomesteadSave } from "../fixtures/saves";
import { makeHighDamageCard } from "./cards";

/** Persisted destination claim surface for E2E / performance save injection. */
export function destinationInterruptedFlow(destinations: string[]) {
  return {
    kind: "destination" as const,
    destinations,
    selectedBossId: null,
    lastVictoryEnemyType: null,
    lastVictoryContentSystem: null,
  };
}

export async function injectDestinationAtIndex(
  page: Page,
  options: {
    destinations: string[];
    destinationIndexInAct?: number;
    completedDestinations?: string[];
    roomsEncountered?: number;
    runPlayerHealth?: number;
    runMaxHealth?: number;
  },
) {
  const destinationIndexInAct = options.destinationIndexInAct ?? 0;
  await injectSaveState(page, {
    runPlayerHealth: options.runPlayerHealth ?? 30,
    runMaxHealth: options.runMaxHealth ?? 30,
    roomsEncountered: options.roomsEncountered ?? destinationIndexInAct,
    destinationIndexInAct,
    completedDestinations: options.completedDestinations ?? [],
    currentScreen: "destination",
    interruptedFlow: destinationInterruptedFlow(options.destinations),
  });
}

/** Resume on the mystery summary so Continue is the only remaining UI path. */
export async function injectMysterySummaryVisit(page: Page) {
  await injectSaveState(page, {
    runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
    currentScreen: "mystery",
    interruptedFlow: { kind: "none" },
    lastOfferedDestinations: ["Mystery", "Campfire", "Normal Combat"],
    mysteryVisit: {
      eventId: "ancient-altar",
      chosenChoice: { label: "Take the Offering", effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }] },
      pendingRemoval: false,
      cardChoices: null,
      grantedTrinketIds: [],
      grantedGear: [],
      chosenCardId: null,
      resolvedTrinketIds: [],
    },
  });
}

/** Persisted primary-reward claim surface for E2E save injection. */
function primaryRewardInterruptedFlow(pending: Record<string, unknown>) {
  return { kind: "primary-reward" as const, pending };
}

const DEFAULT_PRIMARY_REWARD_PENDING = {
  selectedId: null,
  gold: 0,
  materials: {},
  destinations: [],
  selectedBossId: null,
  lastVictoryEnemyType: "normal",
  lastVictoryContentSystem: "campaign",
};

function createMinimalLabyrinthMap(options?: { rows?: number; cols?: number }) {
  const rows = options?.rows ?? 8;
  const cols = options?.cols ?? 9;
  const grid: Array<
    Array<{
      type: string;
      modifiers: string[];
      rewardModifiers: string[];
      connections: Array<{ row: number; col: number }>;
      state: string;
    } | null>
  > = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
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

async function isDesktopPage(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean(window.alchemyDesktop?.isDesktop)).catch(() => false);
}

/**
 * Waits until the desktop save file is observably written (a save candidate
 * exists) instead of sleeping a fixed 50ms. The desktop bridge exposes no save
 * content read, so this polls `listSaveCandidates` rather than verifying the
 * payload — a content-verified poll would need a new IPC seam.
 */
async function waitForDesktopSaveCandidate(page: Page): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const hasCandidate = await page
      .evaluate(async () => {
        const desktop = window.alchemyDesktop;
        if (!desktop) return false;
        const candidates = (await desktop.listSaveCandidates()) ?? [];
        return candidates.length > 0;
      })
      .catch(() => false);
    if (hasCandidate) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function writeDesktopSaveAndReload(page: Page, save: unknown): Promise<void> {
  const write = async () => {
    const ok = await page.evaluate(async (payload) => {
      const desktop = window.alchemyDesktop;
      if (!desktop?.writeSave) return false;
      if (desktop.clearSave) await desktop.clearSave();
      return desktop.writeSave(JSON.stringify(payload));
    }, save);
    if (!ok) {
      throw new Error("Failed to write desktop save for E2E / performance injection");
    }
  };

  // Double-write: a Victory/rewards autosave can overwrite the first inject before reload.
  await write();
  await waitForDesktopSaveCandidate(page);
  await write();
  await page.reload({ waitUntil: "domcontentloaded" });
}

function buildActiveRunSave(overrides: Record<string, unknown>) {
  const {
    discoveredCardIds,
    encounteredEnemyIds,
    discoveredTrinketIds,
    autoEndTurn,
    selectedAspectRatio,
    ...activeRunData
  } = overrides;
  const save: Record<string, unknown> = {
    ...baseHomesteadSave,
    // E2E battles assert on a stable opening hand; auto-end races empty/mid-draw states.
    autoEndTurn: autoEndTurn === true,
    ...(typeof selectedAspectRatio === "string" ? { selectedAspectRatio } : {}),
    activeRun: {
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
    },
    finishedRunCharacters: ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid"],
    discoveredCardIds: Array.isArray(discoveredCardIds)
      ? discoveredCardIds
      : ["slash", "bash", "block", "anvil", "plate-mail", "apple", "meteor", "blessed-aegis"],
  };
  if (Array.isArray(encounteredEnemyIds)) save.encounteredEnemyIds = encounteredEnemyIds;
  if (Array.isArray(discoveredTrinketIds)) save.discoveredTrinketIds = discoveredTrinketIds;
  return save;
}

export async function injectSaveState(page: Page, overrides: Record<string, unknown> = {}) {
  if (await isDesktopPage(page)) {
    await writeDesktopSaveAndReload(page, buildActiveRunSave(overrides));
    return;
  }

  const injectionId = Math.random().toString(36).substring(2);
  await page.addInitScript(
    (data) => {
      if (sessionStorage.getItem("alchemy-injected-id") === data.injectionId) {
        return;
      }
      sessionStorage.setItem("alchemy-injected-id", data.injectionId);
      const save = JSON.parse(localStorage.getItem(data.saveKey) || "{}");
      const {
        discoveredCardIds,
        encounteredEnemyIds,
        discoveredTrinketIds,
        autoEndTurn,
        selectedAspectRatio,
        ...activeRunData
      } = data.payload;
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
      // E2E battles assert on a stable opening hand; auto-end races empty/mid-draw states.
      save.autoEndTurn = autoEndTurn === true;
      if (typeof selectedAspectRatio === "string") save.selectedAspectRatio = selectedAspectRatio;
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
    { saveKey: SAVE_KEY, payload: overrides, injectionId },
  );
}

/** Inject a mid-claim primary reward screen and navigate to it. */
export async function enterPrimaryRewardScreen(page: Page, pending: Record<string, unknown>) {
  await injectSaveState(page, {
    runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
    currentScreen: "rewards",
    interruptedFlow: primaryRewardInterruptedFlow({ ...DEFAULT_PRIMARY_REWARD_PENDING, ...pending }),
  });
  await page.goto("/");
}

export async function injectHomestead(page: Page, overrides: Record<string, unknown> = {}) {
  const save = { ...baseHomesteadSave, ...overrides };
  if (await isDesktopPage(page)) {
    await writeDesktopSaveAndReload(page, save);
    return;
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
    currentScreen: "destination",
    interruptedFlow: {
      kind: "destination",
      destinations: ["Boss Combat"],
      selectedBossId: act === 1 ? "forge-golem" : act === 2 ? "frostwarden" : "blight-treant",
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    },
  });
}

export async function injectLabyrinthRun(
  page: Page,
  options: {
    runOverrides?: Record<string, unknown>;
    deck?: Array<Record<string, unknown>>;
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
        Object.assign(save.activeRun as Record<string, unknown>, data.runOverrides);
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
