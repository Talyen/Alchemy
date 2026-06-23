import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION } from "../metadata";
import { migrateSaveTopLevelV4 } from "./migrate-save-top-level";
import { migrateSaveTopLevelV5 } from "./migrate-save-top-level-v5";
import type { RawSaveData } from "./types";
import { normalizePositiveInteger } from "./types";
import { EMPTY_CRAFTING_CURRENCIES, createEmptyCurrencyBoardPositionsByCharacter } from "@/lib/gear";
import {
  GEAR_CHARACTER_IDS,
  createEmptyGearBoardPositionsByCharacter,
  createEmptyGearInventories,
  findGearEquippedCharacter,
  normalizeGearLoadout,
  type GearInstance,
  type GearLoadouts,
} from "@/lib/gear/types";
import type { CraftingCurrencyBoardPositions } from "@/lib/gear/crafting";

// Maps old fixed-resolution strings (v0 save format) to the canonical aspect-ratio values
// used in v1+. Only runs after schema migration so the field is already at its new name.
const LEGACY_RESOLUTION_TO_ASPECT_RATIO = {
  "1920x1080": "16:9",
  "1920x1200": "16:10",
  "2560x1080": "21:9",
} as const;

function remapArrowKeywordProgress(record: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!record || typeof record !== "object") return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "arrow") continue;
    next[key] = value;
  }
  if ("arrow" in record) {
    const archeryValue = record.archery;
    const arrowValue = record.arrow;
    if (typeof archeryValue === "number" && typeof arrowValue === "number") {
      next.archery = archeryValue + arrowValue;
    } else if (archeryValue !== undefined) {
      next.archery = archeryValue;
    } else if (arrowValue !== undefined) {
      next.archery = arrowValue;
    }
  }
  return next;
}

function remapArrowTalentId(id: string): string {
  if (id === "arrow-damage") return "archery-damage";
  const placeholderMatch = /^arrow-placeholder-(\d+)$/.exec(id);
  if (placeholderMatch) return `archery-placeholder-${placeholderMatch[1]}`;
  if (id.startsWith("arrow-")) return `archery-${id.slice("arrow-".length)}`;
  return id;
}

function remapArrowUnlockedTalents(record: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!record || typeof record !== "object") return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "arrow") continue;
    next[key] = value;
  }
  const arrowIds = record.arrow;
  const archeryIds = Array.isArray(record.archery)
    ? record.archery.filter((id): id is string => typeof id === "string")
    : [];
  const mergedIds = [
    ...archeryIds,
    ...(Array.isArray(arrowIds)
      ? arrowIds.filter((id): id is string => typeof id === "string").map(remapArrowTalentId)
      : []),
  ];
  if (mergedIds.length > 0) {
    next.archery = Array.from(new Set(mergedIds.filter((id): id is string => typeof id === "string")));
  }
  return next;
}

// Converts persisted selectedResolution → selectedAspectRatio for saves predating the v1
// aspect-ratio picker. If neither field is a string the save is left unchanged (Zod .catch
// will supply the "auto" default during parsing).
export function normalizeLegacyAspectRatio(parsed: RawSaveData): RawSaveData {
  if (typeof parsed.selectedAspectRatio === "string") return parsed;
  if (typeof parsed.selectedResolution !== "string") return parsed;
  const selectedAspectRatio =
    LEGACY_RESOLUTION_TO_ASPECT_RATIO[parsed.selectedResolution as keyof typeof LEGACY_RESOLUTION_TO_ASPECT_RATIO];
  return { ...parsed, selectedAspectRatio };
}

// V0 saves predate schema-version tracking; they lack gameBuildVersion and contentVersion.
export function migrateV0ToV1(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    saveSchemaVersion: 1,
    gameBuildVersion:
      typeof parsed.gameBuildVersion === "string" ? parsed.gameBuildVersion : CURRENT_GAME_BUILD_VERSION,
    contentVersion: normalizePositiveInteger(parsed.contentVersion, CURRENT_CONTENT_VERSION),
  };
}

export function migrateV1ToV2(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    saveSchemaVersion: 2,
    talentXP: remapArrowKeywordProgress(parsed.talentXP as Record<string, unknown> | undefined),
    unlockedTalents: remapArrowUnlockedTalents(parsed.unlockedTalents as Record<string, unknown> | undefined),
    runTalentXP:
      parsed.runTalentXP !== undefined
        ? remapArrowKeywordProgress(parsed.runTalentXP as Record<string, unknown> | undefined)
        : parsed.runTalentXP,
  };
}

export function migrateV2ToV3(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    saveSchemaVersion: 3,
    finishedRunCharacters: Array.isArray(parsed.finishedRunCharacters) ? parsed.finishedRunCharacters : [],
  };
}

export function migrateV3ToV4(parsed: RawSaveData): RawSaveData {
  return {
    ...migrateSaveTopLevelV4(parsed),
    saveSchemaVersion: 4,
  };
}

export function migrateV4ToV5(parsed: RawSaveData): RawSaveData {
  return {
    ...migrateSaveTopLevelV5(parsed),
    saveSchemaVersion: 5,
  };
}

const SCALE_1_AFFIXES = new Set([
  "poison-leech",
  "physical-bleed-chance",
  "physical-stun-chance",
  "nature-leech",
  "companion-forge-power",
]);

function migrateGearInstance(item: Record<string, unknown>): Record<string, unknown> {
  const definitionId = item.definitionId;
  if (typeof definitionId !== "string") return item;

  const isAstral = definitionId.endsWith("-astral");
  if (!isAstral) return item;

  const affixes = item.affixes;
  if (!Array.isArray(affixes)) return item;

  const migratedAffixes = affixes.map((affix) => {
    if (!affix || typeof affix !== "object") return affix;
    const a = affix as Record<string, unknown>;
    const id = a.id;
    const value = a.value;
    if (typeof id !== "string" || typeof value !== "number") return affix;

    const scale = SCALE_1_AFFIXES.has(id) ? 1 : 2;
    return {
      ...a,
      value: Math.max(0, Math.round(value * scale)),
    };
  });

  return {
    ...item,
    affixes: migratedAffixes,
  };
}

export function migrateV5ToV6(parsed: RawSaveData): RawSaveData {
  const next = { ...parsed };
  if (Array.isArray(next.gearInventory)) {
    next.gearInventory = (next.gearInventory as Array<Record<string, unknown>>).map(migrateGearInstance);
  }
  if (next.activeRun && typeof next.activeRun === "object") {
    const activeRun = { ...(next.activeRun as Record<string, unknown>) };
    if (activeRun.equipmentShopState && typeof activeRun.equipmentShopState === "object") {
      const shopState = { ...(activeRun.equipmentShopState as Record<string, unknown>) };
      if (Array.isArray(shopState.gear)) {
        shopState.gear = (shopState.gear as Array<Record<string, unknown>>).map(migrateGearInstance);
      }
      activeRun.equipmentShopState = shopState;
    }
    if (activeRun.pendingReward && typeof activeRun.pendingReward === "object") {
      const pendingReward = { ...(activeRun.pendingReward as Record<string, unknown>) };
      if (pendingReward.rewardType === "gear" && Array.isArray(pendingReward.gearChoices)) {
        pendingReward.gearChoices = (pendingReward.gearChoices as Array<Record<string, unknown>>).map(
          migrateGearInstance,
        );
      }
      activeRun.pendingReward = pendingReward;
    }
    if (activeRun.wildwoodDraft && typeof activeRun.wildwoodDraft === "object") {
      const wildwoodDraft = { ...(activeRun.wildwoodDraft as Record<string, unknown>) };
      if (Array.isArray(wildwoodDraft.rewardGearChoices)) {
        wildwoodDraft.rewardGearChoices = (wildwoodDraft.rewardGearChoices as Array<Record<string, unknown>>).map(
          migrateGearInstance,
        );
      }
      activeRun.wildwoodDraft = wildwoodDraft;
    }
    next.activeRun = activeRun;
  }
  return {
    ...next,
    saveSchemaVersion: 6,
  };
}

export function migrateV6ToV7(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    craftingCurrencies:
      parsed.craftingCurrencies !== undefined ? parsed.craftingCurrencies : { ...EMPTY_CRAFTING_CURRENCIES },
    saveSchemaVersion: 7,
  };
}

export function migrateV7ToV8(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    craftingCurrencyBoardPositions:
      parsed.craftingCurrencyBoardPositions !== undefined ? parsed.craftingCurrencyBoardPositions : {},
    saveSchemaVersion: 8,
  };
}

export function migrateV8ToV9(parsed: RawSaveData): RawSaveData {
  if (parsed.gearInventories && typeof parsed.gearInventories === "object") {
    return { ...parsed, saveSchemaVersion: 9 };
  }

  const legacyInventory = Array.isArray(parsed.gearInventory) ? (parsed.gearInventory as GearInstance[]) : [];
  const rawLoadouts = parsed.gearLoadouts;
  const loadouts = GEAR_CHARACTER_IDS.reduce((acc, characterId) => {
    const raw =
      rawLoadouts && typeof rawLoadouts === "object"
        ? (rawLoadouts as Record<string, unknown>)[characterId]
        : undefined;
    acc[characterId] = normalizeGearLoadout(raw as Partial<Record<string, string | null>>);
    return acc;
  }, {} as GearLoadouts);

  const legacyBoardPositions =
    parsed.gearBoardPositions && typeof parsed.gearBoardPositions === "object"
      ? (parsed.gearBoardPositions as Record<string, { col: number; row: number }>)
      : {};
  const legacyCurrencyPositions =
    parsed.craftingCurrencyBoardPositions && typeof parsed.craftingCurrencyBoardPositions === "object"
      ? (parsed.craftingCurrencyBoardPositions as CraftingCurrencyBoardPositions)
      : {};

  const gearInventories = createEmptyGearInventories();
  const gearBoardPositionsByCharacter = createEmptyGearBoardPositionsByCharacter();
  const currencyBoardPositionsByCharacter = createEmptyCurrencyBoardPositionsByCharacter();

  for (const item of legacyInventory) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- item is unknown runtime data from raw save
    if (!item || typeof item !== "object" || typeof item.instanceId !== "string") continue;
    const owner = findGearEquippedCharacter(loadouts, item.instanceId) ?? "knight";
    gearInventories[owner].push(item);
    const position = legacyBoardPositions[item.instanceId];
    if (position) {
      gearBoardPositionsByCharacter[owner][item.instanceId] = position;
    }
  }

  currencyBoardPositionsByCharacter.knight = { ...legacyCurrencyPositions };

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    gearInventory: _gearInventory,
    gearBoardPositions: _gearBoardPositions,
    craftingCurrencyBoardPositions: _craftingCurrencyBoardPositions,
    ...rest
  } = parsed;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  return {
    ...rest,
    gearInventories,
    gearBoardPositionsByCharacter,
    craftingCurrencyBoardPositionsByCharacter: currencyBoardPositionsByCharacter,
    saveSchemaVersion: 9,
  };
}

export const LEGACY_ARMORY_POSITIONS_STORAGE_KEY = "alchemy-armory-positions";

function getStorage(): Storage | null {
  if (typeof localStorage !== "undefined") return localStorage;
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return null;
}

export function readLegacyArmoryBoardPositionsFromStorage(): Record<string, { col: number; row: number }> {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const stored = storage.getItem(LEGACY_ARMORY_POSITIONS_STORAGE_KEY);
    if (!stored) return {};
    storage.removeItem(LEGACY_ARMORY_POSITIONS_STORAGE_KEY);
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, { col: number; row: number }>;
  } catch {
    return {};
  }
}

export function migrateV9ToV10(parsed: RawSaveData): RawSaveData {
  const legacyPositions = readLegacyArmoryBoardPositionsFromStorage();
  if (Object.keys(legacyPositions).length === 0) {
    return { ...parsed, saveSchemaVersion: 10 };
  }

  const existing = parsed.gearBoardPositionsByCharacter;
  const knight: Record<string, { col: number; row: number }> =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? ((existing as Record<string, Record<string, { col: number; row: number }>>).knight ?? {})
      : {};
  const mergedKnight = { ...legacyPositions, ...knight };

  const nextGearBoardPositionsByCharacter =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, Record<string, { col: number; row: number }>>), knight: mergedKnight }
      : { knight: mergedKnight };

  return {
    ...parsed,
    gearBoardPositionsByCharacter: nextGearBoardPositionsByCharacter,
    saveSchemaVersion: 10,
  };
}
