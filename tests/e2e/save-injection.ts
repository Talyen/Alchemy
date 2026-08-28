import { expect, type Page } from "@playwright/test";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import { SAVE_KEY } from "@/lib/game-constants";
import { baseHomesteadSave, ALL_PLAYABLE_CHARACTERS, DEFAULT_DISCOVERED_CARD_IDS } from "../fixtures/saves";
import type { InjectedBattleState } from "../fixtures/battle-state";
import { hexLabyrinthMapFixture } from "../fixtures/labyrinth-hex-map";
import { makeHighDamageCard } from "./cards";

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

export async function injectMysterySummaryVisit(page: Page) {
  await injectSaveState(page, {
    runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
    currentScreen: "mystery",
    interruptedFlow: { kind: "none" },
    lastOfferedDestinations: ["Mystery", "Campfire", "Normal Combat"],
    mysteryVisit: {
      eventId: "ancient-altar",
      chosenChoice: { label: "Take the Offering", effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }] },
      cardChoices: null,
      grantedTrinketIds: [],
      grantedGear: [],
      chosenCardId: null,
      resolvedTrinketIds: [],
    },
  });
}

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

async function isDesktopPage(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean(window.alchemyDesktop?.isDesktop)).catch(() => false);
}

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
    discoveredUniqueIds,
    autoEndTurn,
    selectedAspectRatio,
    gold,
    runGold,
    ...activeRunData
  } = overrides as Record<string, unknown> & { gold?: unknown; runGold?: unknown };

  const injectedGold = typeof gold === "number" ? gold : typeof runGold === "number" ? runGold : undefined;
  const save: Record<string, unknown> = {
    ...baseHomesteadSave,
    ...(injectedGold !== undefined ? { gold: injectedGold } : {}),

    autoEndTurn: autoEndTurn === true,
    ...(typeof selectedAspectRatio === "string" ? { selectedAspectRatio } : {}),
    activeRun: {
      characterId: "knight",
      runDeck: [],
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runBoons: [],
      ...activeRunData,
    },
    finishedRunCharacters: [...ALL_PLAYABLE_CHARACTERS],
    discoveredCardIds: Array.isArray(discoveredCardIds) ? discoveredCardIds : [...DEFAULT_DISCOVERED_CARD_IDS],
  };
  if (Array.isArray(encounteredEnemyIds)) save.encounteredEnemyIds = encounteredEnemyIds;
  if (Array.isArray(discoveredTrinketIds)) save.discoveredTrinketIds = discoveredTrinketIds;
  if (Array.isArray(discoveredUniqueIds)) save.discoveredUniqueIds = discoveredUniqueIds;

  delete save.unlockedTalents;
  return save;
}

export async function injectSaveState(page: Page, overrides: Record<string, unknown> = {}) {
  const save = buildActiveRunSave(overrides);
  if (await isDesktopPage(page)) {
    await writeDesktopSaveAndReload(page, save);
    return;
  }

  const injectionId = Math.random().toString(36).substring(2);
  await page.addInitScript(
    (data) => {
      if (sessionStorage.getItem("alchemy-injected-id") === data.injectionId) {
        return;
      }
      sessionStorage.setItem("alchemy-injected-id", data.injectionId);
      const existing = JSON.parse(localStorage.getItem(data.saveKey) || "{}");
      localStorage.setItem(data.saveKey, JSON.stringify({ ...existing, ...data.save }));
    },
    { saveKey: SAVE_KEY, save, injectionId },
  );
}

export async function injectActiveBattle(
  page: Page,
  battleState: InjectedBattleState,
  overrides: Record<string, unknown> = {},
) {
  await injectSaveState(page, {
    currentScreen: "battle",
    ...overrides,
    activeCombat: {
      battleState,
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
    },
  });
  await page.goto("/");
}

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
    deck?: BattleCard[];
    discoveredCardIds?: string[];
    resume?: boolean;
    labyrinthMap?: LabyrinthMap;
  } = {},
) {
  const map = options.labyrinthMap ?? hexLabyrinthMapFixture();
  const desktop = await isDesktopPage(page);
  await injectSaveState(page, {
    characterId: "knight",
    runDeck: options.deck ?? [],
    runGold: 0,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    runBoons: [],
    selectedDifficulty: null,
    currentScreen: "labyrinth-map",
    contentSystemType: "labyrinth",
    labyrinthMap: map,
    discoveredCardIds: options.discoveredCardIds ?? ["slash"],
    finishedRunCharacters: [...ALL_PLAYABLE_CHARACTERS],
    ...options.runOverrides,
  });
  if (!desktop) await page.goto("/");
  await expect(page.getByRole("heading", { name: /Labyrinth|Map/i })).toBeVisible({ timeout: 20000 });
}

export async function enableLoadingScreen(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("alchemy-skip-loading-screen");
  });
}
