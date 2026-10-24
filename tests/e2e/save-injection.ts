import { savedActivityFixture } from "../fixtures/run-activity";
import { expect, type Page } from "@playwright/test";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data/types";
import { SAVE_KEY } from "@/lib/game-constants";
import { baseHomesteadSave, BASE_ROSTER_CHARACTERS, DEFAULT_DISCOVERED_CARD_IDS } from "../fixtures/saves";
import type { InjectedBattleState } from "../fixtures/battle-state";
import { gridLabyrinthMapFixture } from "../fixtures/labyrinth-map";
import { makeHighDamageCard } from "./cards";
import { navigateToGame, resumeInjectedRun } from "./navigation";
import { failOnRuntimeErrors } from "./errors";
import type { ParsedSaveData } from "@/lib/validation";

export function readSavedGame(page: Page): Promise<ParsedSaveData> {
  return page.evaluate(async (key) => {
    if (window.alchemyDesktop?.isDesktop) {
      const slot = await window.alchemyDesktop.readSaveSlot();
      if (slot.localReadFailed || !slot.candidates[0]) throw new Error("No acknowledged desktop save");
      return JSON.parse(slot.candidates[0]);
    }
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  }, SAVE_KEY);
}

/** Page-level seed scripts rerun on reload; this page reads only the acknowledged save. */
export async function withSavedGame(
  page: Page,
  verify: (resumed: Page) => Promise<void>,
  continueLabel = "Continue",
): Promise<void> {
  const resumed = await page.context().newPage();
  const errors = failOnRuntimeErrors(resumed);
  try {
    await resumed.goto(new URL("/", page.url()).href, { waitUntil: "domcontentloaded" });
    if ((await readSavedGame(resumed)).activeRun) await resumeInjectedRun(resumed, continueLabel);
    await verify(resumed);
    expect(errors).toEqual([]);
  } finally {
    await resumed.close();
  }
}

export async function injectMysterySummaryVisit(page: Page) {
  await injectSaveState(page, {
    runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
    lastOfferedDestinations: ["Mystery", "Campfire", "Normal Combat"],
    activity: savedActivityFixture("mystery", {
      event: {
        id: "ancient-altar",
        title: "Ancient Altar",
        art: "",
        narrative: "A weathered stone altar.",
        choices: [{ label: "Take the Offering", effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }] }],
      },
      chosenChoice: { label: "Take the Offering", effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }] },
      cardChoices: null,
      grantedGear: [],
      chosenCardId: null,
    }),
  });
}

const DEFAULT_PRIMARY_REWARD_PENDING = {
  selectedId: null,
  gold: 0,
  materials: {},
  destinations: ["Normal Combat", "Campfire"],
  selectedBossId: null,
  lastVictoryEnemyType: "normal",
  lastVictoryContentSystem: "campaign",
};

async function isDesktopPage(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean(window.alchemyDesktop?.isDesktop)).catch(() => false);
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

  // Rewards autosave can race the first injection. Keep the second write until
  // renderer teardown can cancel that owner; the bridge already awaits disk acknowledgment.
  await write();
  await write();
  await page.reload({ waitUntil: "domcontentloaded" });
  // A loaded desktop checkpoint includes the cold-start reveal, which may
  // outlast the default assertion timeout before controls become interactive.
  await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30_000 });
}

async function injectLocalStorage(page: Page, save: Record<string, unknown>, merge: boolean) {
  await page.addInitScript(
    (data: { saveKey: string; save: Record<string, unknown>; merge: boolean }) => {
      if (data.merge) {
        const existing = JSON.parse(localStorage.getItem(data.saveKey) || "{}") as Record<string, unknown>;
        localStorage.setItem(data.saveKey, JSON.stringify({ ...existing, ...data.save }));
      } else {
        localStorage.setItem(data.saveKey, JSON.stringify(data.save));
      }
    },
    { saveKey: SAVE_KEY, save, merge },
  );
}

export function buildActiveRunSave(overrides: Record<string, unknown>) {
  const {
    discoveredCardIds,
    encounteredEnemyIds,
    discoveredTrinketIds,
    discoveredUniqueIds,
    autoEndTurn,
    finishedRunCharacters,
    gold,
    runGold,
    ...activeRunData
  } = overrides as Record<string, unknown> & { gold?: unknown; runGold?: unknown };

  const injectedGold = typeof gold === "number" ? gold : typeof runGold === "number" ? runGold : undefined;
  const save: Record<string, unknown> = {
    ...baseHomesteadSave,
    ...(injectedGold !== undefined ? { gold: injectedGold } : {}),

    autoEndTurn: autoEndTurn === true,
    activeRun: {
      characterId: "knight",
      contentSystemType: "campaign",
      ...(process.env.ALCHEMY_EDITION === "demo" ? { selectedDifficulty: "difficulty-1" } : {}),
      runDeck: [],
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runBoons: [],
      activity: savedActivityFixture("destination", {
        destinations: ["Normal Combat", "Campfire", "Card Shop"],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      }),
      ...activeRunData,
    },
    finishedRunCharacters: Array.isArray(finishedRunCharacters) ? finishedRunCharacters : [...BASE_ROSTER_CHARACTERS],
    discoveredCardIds: Array.isArray(discoveredCardIds) ? discoveredCardIds : [...DEFAULT_DISCOVERED_CARD_IDS],
  };
  if (Array.isArray(encounteredEnemyIds)) save.encounteredEnemyIds = encounteredEnemyIds;
  if (Array.isArray(discoveredTrinketIds)) save.discoveredTrinketIds = discoveredTrinketIds;
  if (Array.isArray(discoveredUniqueIds)) save.discoveredUniqueIds = discoveredUniqueIds;

  delete save.unlockedTalents;
  return save;
}

/** Returns whether the desktop adapter already loaded the injected checkpoint. */
export async function injectSaveState(page: Page, overrides: Record<string, unknown> = {}) {
  const save = buildActiveRunSave(overrides);
  if (await isDesktopPage(page)) {
    await writeDesktopSaveAndReload(page, save);
    return true;
  }

  await injectLocalStorage(page, save, true);
  return false;
}

/** Load a production-format checkpoint without the test fixture's default hero or run fields. */
export async function injectExactSave(page: Page, save: Record<string, unknown>): Promise<void> {
  if (await isDesktopPage(page)) {
    await writeDesktopSaveAndReload(page, save);
    return;
  }
  await injectLocalStorage(page, save, false);
}

export async function injectActiveBattle(
  page: Page,
  battleState: InjectedBattleState,
  overrides: Record<string, unknown> = {},
  continueLabel = "Continue",
) {
  const loaded = await injectSaveState(page, {
    activity: savedActivityFixture("battle", {
      battleState,
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
    }),
    ...overrides,
  });
  if (!loaded) await navigateToGame(page);
  await resumeInjectedRun(page, continueLabel);
}

export async function enterPrimaryRewardScreen(page: Page, pending: Record<string, unknown>) {
  const loaded = await injectSaveState(page, {
    runDeck: Array.from({ length: 6 }, () => makeHighDamageCard()),
    activity: savedActivityFixture("rewards", {
      ...DEFAULT_PRIMARY_REWARD_PENDING,
      companionChoiceIds: [],
      ...pending,
    }),
  });
  if (!loaded) await navigateToGame(page);
  await resumeInjectedRun(page);
}

export async function injectHomestead(page: Page, overrides: Record<string, unknown> = {}) {
  const save = { ...baseHomesteadSave, ...overrides };
  if (await isDesktopPage(page)) {
    await writeDesktopSaveAndReload(page, save);
    return true;
  }
  await injectLocalStorage(page, save, false);
  return false;
}

export async function injectBossState(page: Page, act = 1, overrides: Record<string, unknown> = {}) {
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
    activity: savedActivityFixture("destination", {
      kind: "destination",
      destinations: ["Boss Combat"],
      selectedBossId: act === 1 ? "forge-golem" : act === 2 ? "frostwarden" : "blight-treant",
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    }),
    ...overrides,
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
  const map = options.labyrinthMap ?? gridLabyrinthMapFixture();
  const loaded = await injectSaveState(page, {
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
    contentSystemType: "labyrinth",
    labyrinthMap: map,
    discoveredCardIds: options.discoveredCardIds ?? ["slash"],
    finishedRunCharacters: [...BASE_ROSTER_CHARACTERS],
    ...options.runOverrides,
    activity: savedActivityFixture("labyrinth-map"),
  });
  if (!loaded) await navigateToGame(page);
  await resumeInjectedRun(page);
  await expect(page.getByRole("heading", { name: /Labyrinth|Map/i })).toBeVisible({ timeout: 20000 });
}
