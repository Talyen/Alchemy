import { materialLabels, MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import { normalizeAffixRolls, resolveAffixEffects } from "./affixes";
import { gearDefinitions } from "./definitions";
import { mergeGearEffectManifests } from "./effect-manifest";
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

function instanceRarity(instance: GearInstance): GearDefinition["rarity"] {
  return gearDefinitions[instance.definitionId]?.rarity ?? "basic";
}

const LEGACY_GEAR_DEFINITION_IDS: Record<string, string> = {
  "leather-hood-basic": "leather-helm-basic",
  "great-axe-basic": "double-axe-basic",
  "great-axe-astral": "double-axe-astral",
  "great-mace-basic": "maul-basic",
  "great-mace-astral": "maul-astral",
  "great-sword-basic": "greatsword-basic",
  "great-sword-astral": "greatsword-astral",
  "hand-axe-basic": "hatchet-basic",
  "hand-axe-astral": "hatchet-astral",
  "long-sword-basic": "longsword-basic",
  "long-sword-astral": "longsword-astral",
  "sword-basic": "longsword-basic",
  "sword-astral": "longsword-astral",
  "short-sword-basic": "shortsword-basic",
  "short-sword-astral": "shortsword-astral",
  "gladius-basic": "shortsword-basic",
  "shortsword-basic": "shortsword-basic",
  "shortsword-astral": "shortsword-astral",
  "long-bow-basic": "longbow-basic",
  "long-bow-astral": "longbow-astral",
  "short-bow-basic": "shortbow-basic",
  "short-bow-astral": "shortbow-astral",
  "leather-shield-basic": "leather-buckler-basic",
  "leather-shield-astral": "leather-buckler-astral",
  "plate-shield-basic": "kite-shield-basic",
  "plate-shield-astral": "kite-shield-astral",
};

export function normalizeGearInstance(raw: {
  instanceId?: string;
  definitionId?: string;
  affixes?: { id: string; value: number }[];
  affixIds?: string[];
  modifiers?: GearModifier[];
}): GearInstance | null {
  const definitionId = raw.definitionId
    ? (LEGACY_GEAR_DEFINITION_IDS[raw.definitionId] ?? raw.definitionId)
    : undefined;
  if (!raw.instanceId || !definitionId || !gearDefinitions[definitionId]) return null;

  return {
    instanceId: raw.instanceId,
    definitionId,
    affixes: normalizeAffixRolls(raw),
  };
}

export function effectsForInstance(instance: GearInstance): GearEffectManifest {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return { ...defaultGearEffects };
  const rarity = instanceRarity(instance) ?? "basic";
  const affixEffects = resolveAffixEffects(instance.affixes, rarity);
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

export function computeGearMaxHealthBonus(
  characterId: GearCharacterId,
  inventory: GearInstance[],
  loadouts: GearLoadouts,
): number {
  return computeGearManifest(characterId, inventory, loadouts).maxHealth;
}

export function formatSalvageValue(materials: MaterialInventory): string {
  const parts = MATERIAL_IDS.flatMap((id) => {
    const amount = materials[id];
    return amount > 0 ? [`${amount} ${materialLabels[id]}`] : [];
  });
  return parts.length > 0 ? `Salvage for ${parts.join(", ")}` : "Salvage";
}
