export const GEAR_SLOTS = ["main-hand", "off-hand", "body", "left-accessory", "right-accessory"] as const;
export const ARMORY_SLOTS = ["main-hand", "off-hand", "body", "left-accessory", "trinket", "right-accessory"] as const;

export type GearSlot = (typeof GEAR_SLOTS)[number];
export type ArmorySlot = (typeof ARMORY_SLOTS)[number];
export type GearRarity = "basic" | "astral" | "unique";

export const GEAR_RARITIES = ["basic", "astral", "unique"] as const satisfies readonly GearRarity[];

export const GEAR_CHARACTER_IDS = [
  "knight",
  "ranger",
  "rogue",
  "wizard",
  "alchemist",
  "warlock",
  "druid",
  "wildcard",
] as const satisfies readonly string[];
export type GearCharacterId = (typeof GEAR_CHARACTER_IDS)[number];

export type { GearEffectManifest } from "./gear-effect-manifest";
export { defaultGearEffects, GEAR_EFFECT_KEYS } from "./gear-effect-manifest";

export type { GearAffixId } from "./affix-catalog";

export type { GearAffixRoll, GearDefinition, GearInstance } from "./definitions";
import type { GearInstance } from "./definitions";

export type GearInventory = GearInstance[];
export type GearInventories = Record<GearCharacterId, GearInventory>;
export type GearLoadout = Record<GearSlot, string | null>;
export type GearLoadouts = Record<GearCharacterId, GearLoadout>;
export type EquippedTrinkets = Record<GearCharacterId, string | null>;

export function createEmptyGearInventories(): GearInventories {
  return Object.fromEntries(GEAR_CHARACTER_IDS.map((id) => [id, [] as GearInventory])) as GearInventories;
}

export function flattenGearInventories(inventories: GearInventories): GearInventory {
  return GEAR_CHARACTER_IDS.flatMap((id) => inventories[id]);
}

export function findGearEquippedCharacter(loadouts: GearLoadouts, instanceId: string): GearCharacterId | null {
  for (const characterId of GEAR_CHARACTER_IDS) {
    for (const slot of GEAR_SLOTS) {
      if (loadouts[characterId][slot] === instanceId) return characterId;
    }
  }
  return null;
}

export function findGearInventoryOwner(inventories: GearInventories, instanceId: string): GearCharacterId | null {
  for (const characterId of GEAR_CHARACTER_IDS) {
    if (inventories[characterId].some((item) => item.instanceId === instanceId)) {
      return characterId;
    }
  }
  return null;
}

export function createEmptyGearLoadout(): GearLoadout {
  return Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, null])) as GearLoadout;
}

export function createEmptyGearLoadouts(): GearLoadouts {
  return Object.fromEntries(GEAR_CHARACTER_IDS.map((id) => [id, createEmptyGearLoadout()])) as GearLoadouts;
}

export function createEmptyEquippedTrinkets(): EquippedTrinkets {
  return Object.fromEntries(GEAR_CHARACTER_IDS.map((id) => [id, null])) as EquippedTrinkets;
}

export function normalizeEquippedTrinkets(value: Partial<EquippedTrinkets> | null | undefined): EquippedTrinkets {
  const next = createEmptyEquippedTrinkets();
  if (!value) return next;
  for (const characterId of GEAR_CHARACTER_IDS) {
    const trinketId = value[characterId];
    next[characterId] = typeof trinketId === "string" ? trinketId : null;
  }
  return next;
}

export function normalizeGearLoadout(loadout: Partial<GearLoadout> | null | undefined): GearLoadout {
  const next = createEmptyGearLoadout();
  if (!loadout) return next;
  for (const slot of GEAR_SLOTS) {
    const value = loadout[slot];
    if (value !== undefined) next[slot] = value;
  }
  return next;
}

export function normalizeExclusiveGearLoadouts(loadouts: GearLoadouts): GearLoadouts {
  const seen = new Set<string>();
  const next = createEmptyGearLoadouts();

  for (const characterId of GEAR_CHARACTER_IDS) {
    for (const slot of GEAR_SLOTS) {
      const instanceId = loadouts[characterId][slot];
      if (!instanceId || seen.has(instanceId)) continue;
      seen.add(instanceId);
      next[characterId][slot] = instanceId;
    }
  }

  return next;
}

export function pruneOrphanGearLoadouts(inventory: GearInventory, loadouts: GearLoadouts): GearLoadouts {
  const inventoryIds = new Set(inventory.map((item) => item.instanceId));
  const next = createEmptyGearLoadouts();

  for (const characterId of GEAR_CHARACTER_IDS) {
    for (const slot of GEAR_SLOTS) {
      const instanceId = loadouts[characterId][slot];
      next[characterId][slot] = instanceId && inventoryIds.has(instanceId) ? instanceId : null;
    }
  }

  return next;
}
