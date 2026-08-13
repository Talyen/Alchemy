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

  if (slot === "off-hand") {
    if (isQuiver(definition)) {
      return mainHandDef ? isRangedWeapon(mainHandDef) : false;
    }
    if (mainHandDef && isRangedWeapon(mainHandDef)) {
      return false;
    }
  }
  if (slot === "main-hand" && !isRangedWeapon(definition) && offHandDef && isQuiver(offHandDef)) {
    return false;
  }
  return true;
}

function resolveMainHandTwoHanded(loadout: GearLoadouts[GearCharacterId]): GearLoadouts[GearCharacterId] {
  return { ...loadout, "off-hand": null };
}

function resolveOffHand(
  loadout: GearLoadouts[GearCharacterId],
  inventory: GearInstance[],
): GearLoadouts[GearCharacterId] {
  const mainHandDefinition = resolveEquippedDefinitionAt(inventory, loadout, "main-hand");
  if (mainHandDefinition && isTwoHanded(mainHandDefinition)) {
    return { ...loadout, "main-hand": null };
  }
  return loadout;
}

function resolveSingleMainHand(
  loadout: GearLoadouts[GearCharacterId],
  definition: GearDefinition,
  inventory: GearInstance[],
): GearLoadouts[GearCharacterId] {
  const offHandDef = resolveEquippedDefinitionAt(inventory, loadout, "off-hand");
  if (!offHandDef) return loadout;
  if (offHandDef.requiresTwoHands) return { ...loadout, "off-hand": null };
  if (isQuiver(offHandDef) && !isRangedWeapon(definition)) return { ...loadout, "off-hand": null };
  if (isRangedWeapon(definition) && !isQuiver(offHandDef)) return { ...loadout, "off-hand": null };
  return loadout;
}

function resolveHandConflicts(
  characterLoadout: GearLoadouts[GearCharacterId],
  slot: GearSlot,
  definition: GearDefinition,
  inventory: GearInstance[],
): GearLoadouts[GearCharacterId] {
  const next = { ...characterLoadout, [slot]: characterLoadout[slot] };
  if (slot === "main-hand" && isTwoHanded(definition)) return resolveMainHandTwoHanded(next);
  if (slot === "off-hand") return resolveOffHand(next, inventory);
  return resolveSingleMainHand(next, definition, inventory);
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

export function salvageGear(inventory: GearInstance[], loadouts: GearLoadouts, instanceId: string, rng: () => number) {
  if (!canSalvageGear(inventory, instanceId)) return null;
  const instance = inventory.find((item) => item.instanceId === instanceId);
  if (!instance) return null;
  return {
    inventory: inventory.filter((item) => item.instanceId !== instanceId),
    loadouts: removeGearFromLoadouts(loadouts, instanceId),
    yieldedCurrencies: rollSalvageYield(gearInstanceRarity(instance), rng),
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

  return {
    instanceId,
    definitionId,
    affixes: normalizeAffixRolls(rawAffixes),
  };
}

export function effectsForInstance(instance: GearInstance): GearEffectManifest {
  if (!gearDefinitions[instance.definitionId]) return { ...defaultGearEffects };
  return resolveAffixEffects(instance.affixes);
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
