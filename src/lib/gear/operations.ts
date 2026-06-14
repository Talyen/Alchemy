import { materialLabels, MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import { gearDefinitions } from "./data";
import {
  GEAR_SLOTS,
  defaultGearEffects,
  type GearDefinition,
  type GearCharacterId,
  type GearEffectManifest,
  type GearInstance,
  type GearLoadouts,
  type GearModifier,
  type GearSlot,
} from "./types";

export function isGearCompatibleWithSlot(definition: GearDefinition, slot: GearSlot): boolean {
  return definition.compatibleSlots.includes(slot);
}

export function equipGear(
  loadouts: GearLoadouts,
  characterId: GearCharacterId,
  slot: GearSlot,
  instance: GearInstance,
): GearLoadouts {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition || !isGearCompatibleWithSlot(definition, slot)) return loadouts;
  const next = { ...loadouts[characterId] };
  for (const currentSlot of GEAR_SLOTS) if (next[currentSlot] === instance.instanceId) next[currentSlot] = null;
  next[slot] = instance.instanceId;
  return { ...loadouts, [characterId]: next };
}

export function unequipGear(loadouts: GearLoadouts, characterId: GearCharacterId, slot: GearSlot): GearLoadouts {
  return { ...loadouts, [characterId]: { ...loadouts[characterId], [slot]: null } };
}

export function getEquippedCharacterIds(loadouts: GearLoadouts, instanceId: string): GearCharacterId[] {
  return (Object.keys(loadouts) as GearCharacterId[]).filter((id) => Object.values(loadouts[id]).includes(instanceId));
}

export function canSalvageGear(loadouts: GearLoadouts, instanceId: string): boolean {
  return getEquippedCharacterIds(loadouts, instanceId).length === 0;
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

function mergeGearEffects(base: GearEffectManifest, addition: GearEffectManifest): GearEffectManifest {
  return {
    flatPhysicalDamage: base.flatPhysicalDamage + addition.flatPhysicalDamage,
  };
}

export function applyGearModifiers(manifest: GearEffectManifest, modifiers: GearModifier[]): GearEffectManifest {
  let next = { ...manifest };
  for (const modifier of modifiers) {
    switch (modifier.kind) {
      case "flatPhysicalDamage":
        next = { ...next, flatPhysicalDamage: next.flatPhysicalDamage + modifier.value };
        break;
      default:
        break;
    }
  }
  return next;
}

function effectsForInstance(instance: GearInstance): GearEffectManifest {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return { ...defaultGearEffects };
  return applyGearModifiers({ ...definition.effects }, instance.modifiers);
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
      return instance ? mergeGearEffects(effects, effectsForInstance(instance)) : effects;
    },
    { ...defaultGearEffects },
  );
}

export function getEquippedGearEffects(
  characterId: GearCharacterId,
  inventory: GearInstance[],
  loadouts: GearLoadouts,
): GearEffectManifest {
  return computeGearManifest(characterId, inventory, loadouts);
}

export function formatSalvageValue(materials: MaterialInventory): string {
  const parts = MATERIAL_IDS.flatMap((id) => {
    const amount = materials[id];
    return amount > 0 ? [`${amount} ${materialLabels[id]}`] : [];
  });
  return parts.length > 0 ? `Salvage for ${parts.join(", ")}` : "Salvage";
}
