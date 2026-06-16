import { materialLabels, MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import { isGearAffixId, modifiersToAffixIds, resolveAffixEffects } from "./affixes";
import { gearDefinitions } from "./definitions";
import { mergeGearEffectManifests } from "./effect-manifest";
import {
  GEAR_SLOTS,
  defaultGearEffects,
  type GearAffixId,
  type GearDefinition,
  type GearCharacterId,
  type GearEffectManifest,
  type GearInstance,
  type GearLoadouts,
  type GearModifier,
  type GearSlot,
} from "./types";

export { mergeGearEffectManifests, subtractGearEffectManifests } from "./effect-manifest";

export function isGearCompatibleWithSlot(definition: GearDefinition, slot: GearSlot): boolean {
  return definition.compatibleSlots.includes(slot);
}

export function isTwoHanded(definition: GearDefinition): boolean {
  return definition.requiresTwoHands;
}

function resolveEquippedDefinition(
  inventory: GearInstance[],
  loadout: GearLoadouts[GearCharacterId],
  slot: GearSlot,
): GearDefinition | undefined {
  const instanceId = loadout[slot];
  if (!instanceId) return undefined;
  const instance = inventory.find((item) => item.instanceId === instanceId);
  if (!instance) return undefined;
  return gearDefinitions[instance.definitionId];
}

function resolveHandConflicts(
  characterLoadout: GearLoadouts[GearCharacterId],
  slot: GearSlot,
  definition: GearDefinition,
  inventory: GearInstance[],
): GearLoadouts[GearCharacterId] {
  const next = { ...characterLoadout, [slot]: characterLoadout[slot] };

  if (slot === "main-hand" && isTwoHanded(definition)) {
    next["off-hand"] = null;
    return next;
  }

  if (slot === "off-hand") {
    const mainHandDefinition = resolveEquippedDefinition(inventory, next, "main-hand");
    if (mainHandDefinition && isTwoHanded(mainHandDefinition)) {
      next["main-hand"] = null;
    }
    return next;
  }

  if (slot === "main-hand" && !isTwoHanded(definition)) {
    const offHandDefinition = resolveEquippedDefinition(inventory, next, "off-hand");
    if (offHandDefinition?.requiresTwoHands) {
      next["off-hand"] = null;
    }
  }

  return next;
}

export function equipGear(
  loadouts: GearLoadouts,
  characterId: GearCharacterId,
  slot: GearSlot,
  instance: GearInstance,
  inventory: GearInstance[],
): GearLoadouts {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition || !isGearCompatibleWithSlot(definition, slot)) return loadouts;
  if (!inventory.some((item) => item.instanceId === instance.instanceId)) return loadouts;

  const next = Object.fromEntries(
    Object.entries(loadouts).map(([currentCharacterId, loadout]) => [
      currentCharacterId,
      Object.fromEntries(
        GEAR_SLOTS.map((currentSlot) => [
          currentSlot,
          loadout[currentSlot] === instance.instanceId ? null : loadout[currentSlot],
        ]),
      ),
    ]),
  ) as GearLoadouts;

  const characterLoadout = { ...next[characterId], [slot]: instance.instanceId };
  next[characterId] = resolveHandConflicts(characterLoadout, slot, definition, inventory);
  return next;
}

export function unequipGear(loadouts: GearLoadouts, characterId: GearCharacterId, slot: GearSlot): GearLoadouts {
  return { ...loadouts, [characterId]: { ...loadouts[characterId], [slot]: null } };
}

export function canSalvageGear(loadouts: GearLoadouts, instanceId: string): boolean {
  return !Object.values(loadouts).some((loadout) => Object.values(loadout).includes(instanceId));
}

export function salvageGear(inventory: GearInstance[], loadouts: GearLoadouts, instanceId: string) {
  if (!canSalvageGear(loadouts, instanceId)) return null;
  const instance = inventory.find((item) => item.instanceId === instanceId);
  if (!instance) return null;
  return {
    inventory: inventory.filter((item) => item.instanceId !== instanceId),
    materials: gearDefinitions[instance.definitionId]?.salvageValue ?? emptyInventory(),
  };
}

export function normalizeGearInstance(raw: {
  instanceId?: string;
  definitionId?: string;
  affixIds?: string[];
  modifiers?: GearModifier[];
}): GearInstance | null {
  if (!raw.instanceId || !raw.definitionId || !gearDefinitions[raw.definitionId]) return null;

  const validAffixIds = (raw.affixIds ?? []).filter((id): id is GearAffixId => isGearAffixId(id));
  const affixIds = validAffixIds.length > 0 ? validAffixIds : raw.modifiers ? modifiersToAffixIds(raw.modifiers) : [];

  return {
    instanceId: raw.instanceId,
    definitionId: raw.definitionId,
    affixIds,
  };
}

export function effectsForInstance(instance: GearInstance): GearEffectManifest {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return { ...defaultGearEffects };
  const affixEffects = resolveAffixEffects(instance.affixIds);
  return mergeGearEffectManifests({ ...definition.effects }, affixEffects);
}

export function computeGearManifest(
  characterId: GearCharacterId,
  inventory: GearInstance[],
  loadouts: GearLoadouts,
): GearEffectManifest {
  const byId = new Map(inventory.map((item) => [item.instanceId, item]));
  return Object.values(loadouts[characterId]).reduce<GearEffectManifest>(
    (effects, instanceId) => {
      const instance = instanceId ? byId.get(instanceId) : undefined;
      return instance ? mergeGearEffectManifests(effects, effectsForInstance(instance)) : effects;
    },
    { ...defaultGearEffects },
  );
}

export function formatSalvageValue(materials: MaterialInventory): string {
  const parts = MATERIAL_IDS.flatMap((id) => {
    const amount = materials[id];
    return amount > 0 ? [`${amount} ${materialLabels[id]}`] : [];
  });
  return parts.length > 0 ? `Salvage for ${parts.join(", ")}` : "Salvage";
}
