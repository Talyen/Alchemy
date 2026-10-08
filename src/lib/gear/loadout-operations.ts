import { gearDefinitions } from "./definitions";
import {
  createEmptyGearLoadouts,
  normalizeExclusiveGearLoadouts,
  GEAR_CHARACTER_IDS,
  GEAR_SLOTS,
  type GearDefinition,
  type GearCharacterId,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
} from "./types";

function isGearCompatibleWithSlot(definition: GearDefinition, slot: GearSlot): boolean {
  return definition.compatibleSlots.includes(slot);
}

function resolveEquippedDefinitionAt(
  inventory: GearInstance[],
  loadout: GearLoadouts[GearCharacterId],
  slot: GearSlot,
): GearDefinition | undefined {
  const instanceId = loadout[slot];
  if (!instanceId) return undefined;
  const instance = inventory.find((item) => item.instanceId === instanceId);
  return instance ? gearDefinitions[instance.definitionId] : undefined;
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
  if (mainHand?.slotRule === "ranged" && offHand && offHand.slotRule !== "quiver") {
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
  const definitionById = new Map(inventory.map((item) => [item.instanceId, gearDefinitions[item.definitionId]]));
  const next = createEmptyGearLoadouts();

  for (const characterId of GEAR_CHARACTER_IDS) {
    for (const slot of GEAR_SLOTS) {
      const instanceId = loadouts[characterId][slot];
      const definition = instanceId ? definitionById.get(instanceId) : undefined;
      if (instanceId && definition && isGearCompatibleWithSlot(definition, slot)) next[characterId][slot] = instanceId;
    }
    const mainHand = definitionById.get(next[characterId]["main-hand"] ?? "");
    const offHand = definitionById.get(next[characterId]["off-hand"] ?? "");
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
  // Resolve the current inventory item before checking hand displacement;
  // a stale caller's definition must not unequip unrelated equipment.
  const owned = inventory.find((item) => item.instanceId === instance.instanceId);
  const definition = owned ? gearDefinitions[owned.definitionId] : undefined;
  if (!definition) return loadouts;
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

function removeGearFromLoadouts(loadouts: GearLoadouts, instanceId: string): GearLoadouts {
  const next = createEmptyGearLoadouts();
  for (const characterId of GEAR_CHARACTER_IDS) {
    for (const slot of GEAR_SLOTS) {
      const equipped = loadouts[characterId][slot];
      if (equipped !== instanceId) next[characterId][slot] = equipped;
    }
  }
  return next;
}
