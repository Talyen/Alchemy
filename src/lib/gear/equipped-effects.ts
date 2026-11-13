import { addAffixRollEffects, effectsForAffixRolls, getGearInstanceAffixes } from "./affixes";
import { gearDefinitions } from "./definitions";
import {
  GEAR_SLOTS,
  createEmptyGearEffectManifest,
  type GearCharacterId,
  type GearEffectManifest,
  type GearInstance,
  type GearLoadouts,
} from "./types";

export function effectsForInstance(instance: GearInstance): GearEffectManifest {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return createEmptyGearEffectManifest();
  return effectsForAffixRolls(getGearInstanceAffixes(instance), definition.rarity);
}

export function computeGearManifest(
  characterId: GearCharacterId,
  inventory: GearInstance[],
  loadouts: GearLoadouts,
): GearEffectManifest {
  const manifest: GearEffectManifest = createEmptyGearEffectManifest();
  const characterLoadout = loadouts[characterId];
  if (!characterLoadout) return manifest;
  let equippedIds: Set<string> | undefined;
  for (const slot of GEAR_SLOTS) {
    const id = characterLoadout[slot];
    if (id) (equippedIds ??= new Set()).add(id);
  }
  if (!equippedIds) return manifest;

  const byId = new Map<string, GearInstance>();
  for (const item of inventory) {
    if (equippedIds.has(item.instanceId)) byId.set(item.instanceId, item);
  }

  for (const slot of GEAR_SLOTS) {
    const instanceId = characterLoadout[slot];
    // One physical item contributes once, even before a malformed loadout is repaired.
    if (!instanceId || !equippedIds.delete(instanceId)) continue;
    const instance = byId.get(instanceId);
    if (!instance) continue;
    const definition = gearDefinitions[instance.definitionId];
    if (!definition) continue;
    // Rolls are already normalized by save parsing and generation, but normalize
    // again so a stale or hand-edited roll clamps exactly like effectsForInstance.
    addAffixRollEffects(manifest, getGearInstanceAffixes(instance), definition.rarity);
  }

  return manifest;
}
