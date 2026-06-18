import { normalizeAffixRolls, resolveAffixEffects } from "./affixes";
import { rollSalvageYield } from "./crafting";
import { gearDefinitions, gearInstanceRarity } from "./definitions";
import { mergeGearEffectManifests } from "./gear-effect-manifest";
import {
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
  return definition.requiresTwoHands;
}

export function isRangedWeapon(definition: GearDefinition): boolean {
  return definition.rangedWeapon === true;
}

export function isQuiver(definition: GearDefinition): boolean {
  return definition.quiver === true;
}

function resolveEquippedDefinitionAt(
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

export function isGearCompatibleWithLoadoutSlot(
  definition: GearDefinition,
  slot: GearSlot,
  characterLoadout: GearLoadouts[GearCharacterId],
  inventory: GearInstance[],
): boolean {
  if (!isGearCompatibleWithSlot(definition, slot)) return false;

  const mainHandDef = resolveEquippedDefinitionAt(inventory, characterLoadout, "main-hand");
  const offHandDef = resolveEquippedDefinitionAt(inventory, characterLoadout, "off-hand");

  if (slot === "off-hand" && isQuiver(definition)) {
    return mainHandDef ? isRangedWeapon(mainHandDef) : false;
  }
  if (slot === "main-hand" && !isRangedWeapon(definition) && offHandDef && isQuiver(offHandDef)) {
    return false;
  }
  return true;
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
    } else if (offHandDefinition && isQuiver(offHandDefinition) && !isRangedWeapon(definition)) {
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
  if (!definition) return loadouts;
  if (!inventory.some((item) => item.instanceId === instance.instanceId)) return loadouts;
  if (!isGearCompatibleWithLoadoutSlot(definition, slot, loadouts[characterId], inventory)) return loadouts;

  const next: GearLoadouts = { ...loadouts };
  for (const currentCharacterId of GEAR_CHARACTER_IDS) {
    const loadout = loadouts[currentCharacterId];
    const nextLoadout = { ...loadout };
    for (const currentSlot of GEAR_SLOTS) {
      if (loadout[currentSlot] === instance.instanceId) {
        nextLoadout[currentSlot] = null;
      }
    }
    next[currentCharacterId] = nextLoadout;
  }

  const characterLoadout = { ...next[characterId], [slot]: instance.instanceId };
  next[characterId] = resolveHandConflicts(characterLoadout, slot, definition, inventory);
  return next;
}

export function unequipGear(loadouts: GearLoadouts, characterId: GearCharacterId, slot: GearSlot): GearLoadouts {
  return { ...loadouts, [characterId]: { ...loadouts[characterId], [slot]: null } };
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
  rng: () => number = Math.random,
) {
  if (!canSalvageGear(inventory, instanceId)) return null;
  const instance = inventory.find((item) => item.instanceId === instanceId);
  if (!instance) return null;
  return {
    inventory: inventory.filter((item) => item.instanceId !== instanceId),
    loadouts: removeGearFromLoadouts(loadouts, instanceId),
    yieldedCurrencies: rollSalvageYield(gearInstanceRarity(instance), rng),
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((entry): entry is string => typeof entry === "string");
  return strings.length > 0 ? strings : undefined;
}

function readAffixEntries(value: unknown): { id: string; value: number }[] | undefined {
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

function readModifierEntries(value: unknown): { kind: string; value: number }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const kind = typeof entry.kind === "string" ? entry.kind : undefined;
    const modifierValue = entry.value;
    if (!kind || typeof modifierValue !== "number") return [];
    return [{ kind, value: modifierValue }];
  });
  return entries.length > 0 ? entries : undefined;
}

export function normalizeGearInstance(raw: unknown): GearInstance | null {
  if (!isRecord(raw)) return null;

  const instanceId = typeof raw.instanceId === "string" ? raw.instanceId : undefined;
  const rawDefinitionId = typeof raw.definitionId === "string" ? raw.definitionId : undefined;
  if (!instanceId || !rawDefinitionId) return null;

  const definitionId = LEGACY_GEAR_DEFINITION_IDS[rawDefinitionId] ?? rawDefinitionId;
  if (!gearDefinitions[definitionId]) return null;

  const affixInput: Parameters<typeof normalizeAffixRolls>[0] = {};
  const affixes = readAffixEntries(raw.affixes);
  const affixIds = readStringArray(raw.affixIds);
  const modifiers = readModifierEntries(raw.modifiers);
  if (affixes) affixInput.affixes = affixes;
  if (affixIds) affixInput.affixIds = affixIds;
  if (modifiers) affixInput.modifiers = modifiers;

  return {
    instanceId,
    definitionId,
    affixes: normalizeAffixRolls(affixInput),
  };
}

export function effectsForInstance(instance: GearInstance): GearEffectManifest {
  if (!gearDefinitions[instance.definitionId]) return { ...defaultGearEffects };
  return resolveAffixEffects(instance.affixes, gearInstanceRarity(instance));
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
