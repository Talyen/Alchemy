import { effectsForAffixRolls, getGearInstanceAffixes, normalizeAffixRolls } from "./affixes";
import { gearAffixCatalog } from "./affix-catalog";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import { computeSalvageYield, type SalvageYield } from "./crafting";
import { gearDefinitions } from "./definitions";
import { getUniqueAffixes } from "./unique-catalog";
import {
  createEmptyGearLoadouts,
  normalizeExclusiveGearLoadouts,
  GEAR_CHARACTER_IDS,
  GEAR_SLOTS,
  defaultGearEffects,
  type GearDefinition,
  type GearCharacterId,
  type GearEffectManifest,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
} from "./types";

export function isGearCompatibleWithSlot(definition: GearDefinition, slot: GearSlot): boolean {
  return definition.compatibleSlots.includes(slot);
}

export function isTwoHanded(definition: GearDefinition): boolean {
  return definition.slotRule === "two-handed";
}

export function isRangedWeapon(definition: GearDefinition): boolean {
  return definition.slotRule === "ranged";
}

export function isQuiver(definition: GearDefinition): boolean {
  return definition.slotRule === "quiver";
}

function resolveEquippedDefinitionAt(
  inventoryOrLookup: GearInstance[] | ReadonlyMap<string, GearInstance>,
  loadout: GearLoadouts[GearCharacterId],
  slot: GearSlot,
): GearDefinition | undefined {
  const instanceId = loadout[slot];
  if (!instanceId) return undefined;
  const instance: GearInstance | undefined = Array.isArray(inventoryOrLookup)
    ? inventoryOrLookup.find((item) => item.instanceId === instanceId)
    : inventoryOrLookup.get(instanceId);
  if (!instance) return undefined;
  return gearDefinitions[instance.definitionId];
}

type HandSlot = "main-hand" | "off-hand";
type HandPairResolution = "compatible" | "reject" | HandSlot;

/** Equip preserves the incoming hand; save repair preserves main-hand. Quiver requirements cannot be displaced. */
function resolveHandPair(
  mainHand: GearDefinition | undefined,
  offHand: GearDefinition | undefined,
  incomingSlot?: HandSlot,
): HandPairResolution {
  if (offHand?.slotRule === "quiver" && mainHand?.slotRule !== "ranged") {
    return incomingSlot ? "reject" : "off-hand";
  }
  if (mainHand?.slotRule === "ranged" && offHand && !isQuiver(offHand)) {
    return incomingSlot === "off-hand" ? "reject" : "off-hand";
  }
  if (mainHand?.slotRule === "two-handed" && offHand) {
    return incomingSlot === "off-hand" ? "main-hand" : "off-hand";
  }
  return "compatible";
}

function resolveLoadoutEquip(
  definition: GearDefinition,
  slot: GearSlot,
  characterLoadout: GearLoadouts[GearCharacterId],
  inventory: GearInstance[],
): HandPairResolution {
  if (!isGearCompatibleWithSlot(definition, slot)) return "reject";
  if (slot !== "main-hand" && slot !== "off-hand") return "compatible";
  return resolveHandPair(
    slot === "main-hand" ? definition : resolveEquippedDefinitionAt(inventory, characterLoadout, "main-hand"),
    slot === "off-hand" ? definition : resolveEquippedDefinitionAt(inventory, characterLoadout, "off-hand"),
    slot,
  );
}

export function isGearCompatibleWithLoadoutSlot(
  definition: GearDefinition,
  slot: GearSlot,
  characterLoadout: GearLoadouts[GearCharacterId],
  inventory: GearInstance[],
): boolean {
  return resolveLoadoutEquip(definition, slot, characterLoadout, inventory) !== "reject";
}

export function pruneOrphanGearLoadouts(inventory: GearInstance[], loadouts: GearLoadouts): GearLoadouts {
  const inventoryById = new Map(inventory.map((item) => [item.instanceId, item]));
  const next = createEmptyGearLoadouts();

  for (const characterId of GEAR_CHARACTER_IDS) {
    for (const slot of GEAR_SLOTS) {
      const instanceId = loadouts[characterId][slot];
      const instance = instanceId ? inventoryById.get(instanceId) : undefined;
      const definition = instance ? gearDefinitions[instance.definitionId] : undefined;
      if (instanceId && definition && isGearCompatibleWithSlot(definition, slot)) next[characterId][slot] = instanceId;
    }
    const mainHand = resolveEquippedDefinitionAt(inventoryById, next[characterId], "main-hand");
    const offHand = resolveEquippedDefinitionAt(inventoryById, next[characterId], "off-hand");
    if (resolveHandPair(mainHand, offHand) !== "compatible") next[characterId]["off-hand"] = null;
  }

  return normalizeExclusiveGearLoadouts(next);
}

export function equipGear(
  loadouts: GearLoadouts,
  characterId: GearCharacterId,
  slot: GearSlot,
  instance: GearInstance,
  inventory: GearInstance[],
): GearLoadouts {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return loadouts;
  if (!inventory.some((item) => item.instanceId === instance.instanceId)) return loadouts;
  const resolution = resolveLoadoutEquip(definition, slot, loadouts[characterId], inventory);
  if (resolution === "reject") return loadouts;

  const next = removeGearFromLoadouts(loadouts, instance.instanceId);
  const characterLoadout = { ...next[characterId], [slot]: instance.instanceId };
  if (resolution !== "compatible") characterLoadout[resolution] = null;
  next[characterId] = characterLoadout;
  return pruneOrphanGearLoadouts(inventory, next);
}

export function unequipGear(
  loadouts: GearLoadouts,
  characterId: GearCharacterId,
  slot: GearSlot,
  inventory: GearInstance[],
): GearLoadouts {
  return pruneOrphanGearLoadouts(inventory, {
    ...loadouts,
    [characterId]: { ...loadouts[characterId], [slot]: null },
  });
}

export function canSalvageGear(inventory: GearInstance[], instanceId: string): boolean {
  return inventory.some((item) => item.instanceId === instanceId);
}

function removeGearFromLoadouts(loadouts: GearLoadouts, instanceId: string): GearLoadouts {
  const next: GearLoadouts = { ...loadouts };
  for (const characterId of GEAR_CHARACTER_IDS) {
    const loadout = loadouts[characterId];
    const nextLoadout = { ...loadout };
    for (const slot of GEAR_SLOTS) {
      if (nextLoadout[slot] === instanceId) {
        nextLoadout[slot] = null;
      }
    }
    next[characterId] = nextLoadout;
  }
  return next;
}

export function salvageGear(
  inventory: GearInstance[],
  loadouts: GearLoadouts,
  instanceId: string,
  frozenYield?: SalvageYield,
) {
  if (!canSalvageGear(inventory, instanceId)) return null;
  const instance = inventory.find((item) => item.instanceId === instanceId);
  if (!instance) return null;
  const salvageYield = frozenYield ?? computeSalvageYield(instance);
  const nextInventory = inventory.filter((item) => item.instanceId !== instanceId);
  return {
    inventory: nextInventory,
    loadouts: pruneOrphanGearLoadouts(nextInventory, removeGearFromLoadouts(loadouts, instanceId)),
    yieldedCurrencies: salvageYield.currencies,
    yieldedMaterials: salvageYield.materials,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readAffixEntries(value: unknown): Array<{ id: string; value: number }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const id = typeof entry.id === "string" ? entry.id : undefined;
    const rollValue = entry.value;
    if (!id || typeof rollValue !== "number") return [];
    return [{ id, value: rollValue }];
  });
  return entries.length > 0 ? entries : undefined;
}

export function normalizeGearInstance(raw: unknown): GearInstance | null {
  if (!isRecord(raw)) return null;

  const instanceId = typeof raw.instanceId === "string" ? raw.instanceId : undefined;
  const definitionId = typeof raw.definitionId === "string" ? raw.definitionId : undefined;
  if (!instanceId || !definitionId || !gearDefinitions[definitionId]) return null;

  const rawAffixes = readAffixEntries(raw.affixes);
  const definition = gearDefinitions[definitionId];

  // Unique affixes resolve canonically at read time; stored rolls are dropped
  // so older saves carrying them converge on the catalog without a migration.
  if (getUniqueAffixes(definitionId)) {
    return { instanceId, definitionId, affixes: [] };
  }

  const seen = new Set<string>();
  const affixes = normalizeAffixRolls(rawAffixes, definition.rarity)
    .filter((roll) => {
      if (seen.has(roll.id) || gearAffixCatalog[roll.id].uniqueOnly) return false;
      seen.add(roll.id);
      return true;
    })
    .slice(0, GEAR_AFFIX_COUNT[definition.rarity ?? "basic"].max);
  return {
    instanceId,
    definitionId,
    affixes,
  };
}

export function effectsForInstance(instance: GearInstance): GearEffectManifest {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return { ...defaultGearEffects };
  return effectsForAffixRolls(getGearInstanceAffixes(instance), definition.rarity);
}

export function computeGearManifest(
  characterId: GearCharacterId,
  inventory: GearInstance[],
  loadouts: GearLoadouts,
): GearEffectManifest {
  const byId = new Map(inventory.map((item) => [item.instanceId, item]));
  const manifest: GearEffectManifest = { ...defaultGearEffects };
  const characterLoadout = loadouts[characterId];
  if (!characterLoadout) return manifest;

  for (const slot of GEAR_SLOTS) {
    const instanceId = characterLoadout[slot];
    if (!instanceId) continue;
    const instance = byId.get(instanceId);
    if (!instance) continue;
    const definition = gearDefinitions[instance.definitionId];
    if (!definition) continue;
    // Rolls are already normalized by save parsing and generation, but normalize
    // again so a stale or hand-edited roll clamps exactly like effectsForInstance.
    const rolls = normalizeAffixRolls([...getGearInstanceAffixes(instance)], definition.rarity);
    for (const roll of rolls) {
      const def = gearAffixCatalog[roll.id];
      if (def) {
        manifest[def.effectKey] += roll.value;
      }
    }
  }

  return manifest;
}
