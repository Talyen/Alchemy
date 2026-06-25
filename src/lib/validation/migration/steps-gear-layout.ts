import { createEmptyCurrencyBoardPositionsByCharacter } from "@/lib/gear";
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
import type { RawSaveData } from "./types";

function readLegacyLoadouts(rawLoadouts: unknown): GearLoadouts {
  if (!rawLoadouts || typeof rawLoadouts !== "object") {
    return GEAR_CHARACTER_IDS.reduce((acc, id) => ({ ...acc, [id]: {} }), {} as GearLoadouts);
  }
  return GEAR_CHARACTER_IDS.reduce((acc, characterId) => {
    const raw = (rawLoadouts as Record<string, unknown>)[characterId];
    acc[characterId] = normalizeGearLoadout(raw as Partial<Record<string, string | null>>);
    return acc;
  }, {} as GearLoadouts);
}

function assignLegacyInventory(
  gearInventories: ReturnType<typeof createEmptyGearInventories>,
  gearBoardPositionsByCharacter: ReturnType<typeof createEmptyGearBoardPositionsByCharacter>,
  legacyInventory: GearInstance[],
  loadouts: GearLoadouts,
  legacyBoardPositions: Record<string, { col: number; row: number }>,
): void {
  for (const item of legacyInventory) {
    if (!item || typeof item !== "object" || typeof item.instanceId !== "string") continue;
    const owner = findGearEquippedCharacter(loadouts, item.instanceId) ?? "knight";
    gearInventories[owner].push(item);
    const position = legacyBoardPositions[item.instanceId];
    if (position) gearBoardPositionsByCharacter[owner][item.instanceId] = position;
  }
}

export function migrateV8ToV9(parsed: RawSaveData): RawSaveData {
  if (parsed.gearInventories && typeof parsed.gearInventories === "object") {
    return { ...parsed, saveSchemaVersion: 9 };
  }

  const legacyInventory = Array.isArray(parsed.gearInventory) ? (parsed.gearInventory as GearInstance[]) : [];
  const loadouts = readLegacyLoadouts(parsed.gearLoadouts);
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

  assignLegacyInventory(
    gearInventories,
    gearBoardPositionsByCharacter,
    legacyInventory,
    loadouts,
    legacyBoardPositions,
  );
  currencyBoardPositionsByCharacter.knight = { ...legacyCurrencyPositions };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure to extract ...rest discarding legacy keys
  const { gearInventory, gearBoardPositions, craftingCurrencyBoardPositions, ...rest } = parsed;

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
