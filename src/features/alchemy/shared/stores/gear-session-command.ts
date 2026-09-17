import { findGearEquippedCharacter, findGearInventoryOwner, gearDefinitions } from "@/lib/gear";
import { deriveGearCombatRestrictions } from "./gear-combat-restrictions";
import type { GearDraftView, GearStore } from "./gear-store-types";
import {
  addGearCurrencies,
  addGearInstance,
  addPermanentTrinket,
  applyGearCurrency,
  equipGearInstance,
  equipPermanentTrinket,
  initializeGear,
  resetGear,
  salvageGearInstance,
  unequipGearInstance,
  unequipPermanentTrinket,
} from "./gear-actions";
import { discoverUniqueIds } from "./profile-store";
import { dispatchRunSessionCommand, type GameplayDraft, type SynchronousResult } from "./run-session-command";
import { addMaterialsToStockpile, addRunCurrenciesEarned, awardMaterialsDuringRun } from "./run-session-write-port";
import { rebindLiveRunMeta } from "./run-session-write-port";

function gearCommandView(state: GameplayDraft, markMutated: () => void): GearStore {
  const gear = state.gear;
  const restrictions = deriveGearCombatRestrictions(state);
  // restrictions.gear only tracks equipped items of the locked hero; an
  // unequipped item sitting in their inventory is locked too.
  const isInstanceLocked = (instanceId: string): boolean => {
    if (restrictions.gear[instanceId]) return true;
    const owner = findGearInventoryOwner(gear.inventories, instanceId);
    if (owner && restrictions.characters[owner]) return true;
    const equippedBy = findGearEquippedCharacter(gear.loadouts, instanceId);
    if (equippedBy && restrictions.characters[equippedBy]) return true;
    return false;
  };
  // Void actions always write; boolean actions report success. Either way the
  // view records actual writes explicitly so commands know whether live battle
  // meta needs rebinding — no snapshot comparison required.
  const wrote = <T>(result: T): T => {
    if (result) markMutated();
    return result;
  };
  return {
    get inventories() {
      return gear.inventories;
    },
    get loadouts() {
      return gear.loadouts;
    },
    get ownedTrinketIds() {
      return gear.ownedTrinketIds;
    },
    get equippedTrinkets() {
      return gear.equippedTrinkets;
    },
    get craftingCurrencies() {
      return gear.craftingCurrencies;
    },
    initialize: (inventories, loadouts, craftingCurrencies, ownedTrinketIds, equippedTrinkets) => {
      markMutated();
      initializeGear(gear, inventories, loadouts, craftingCurrencies, ownedTrinketIds, equippedTrinkets);
    },
    addInstance: (instance, characterId) => {
      markMutated();
      addGearInstance(gear, instance, characterId);
      if (gearDefinitions[instance.definitionId]?.rarity === "unique") {
        discoverUniqueIds(state, [instance.definitionId]);
      }
    },
    equip: (characterId, slot, instance) => {
      if (restrictions.characters[characterId] || restrictions.gear[instance.instanceId]) return false;
      return wrote(equipGearInstance(gear, characterId, slot, instance));
    },
    unequip: (characterId, slot) => {
      if (restrictions.characters[characterId]) return false;
      return wrote(unequipGearInstance(gear, characterId, slot));
    },
    addTrinket: (trinketId) => wrote(addPermanentTrinket(gear, trinketId)),
    equipTrinket: (characterId, trinketId) => {
      if (restrictions.characters[characterId] || restrictions.trinkets[trinketId]) return false;
      return wrote(equipPermanentTrinket(gear, characterId, trinketId));
    },
    unequipTrinket: (characterId) => {
      if (restrictions.characters[characterId]) return false;
      return wrote(unequipPermanentTrinket(gear, characterId));
    },
    salvage: (instanceId) => {
      if (isInstanceLocked(instanceId)) return null;
      const result = salvageGearInstance(gear, instanceId);
      if (result) markMutated();
      return result;
    },
    applyCurrency: (currencyId, instanceId, options) => {
      if (isInstanceLocked(instanceId)) return false;
      return wrote(applyGearCurrency(gear, currencyId, instanceId, options));
    },
    addCurrencies: (currencies) => {
      markMutated();
      addGearCurrencies(gear, currencies);
    },
    reset: () => {
      markMutated();
      resetGear(gear);
    },
  };
}

export function dispatchGearMutationWithRunHealthSync<T>(options: {
  mutate: (gear: GearStore) => T & SynchronousResult<T>;
  syncRunHealth?: boolean;
}): T {
  return dispatchRunSessionCommand<T>((draft) => mutateGearWithRunHealthSync<T>(draft, options));
}

export function mutateGearWithRunHealthSync<T>(
  draft: GameplayDraft,
  options: {
    mutate: (gear: GearStore) => T & SynchronousResult<T>;
    syncRunHealth?: boolean | undefined;
  },
): T & SynchronousResult<T> {
  let mutated = false;
  const result = options.mutate(
    gearCommandView(draft, () => {
      mutated = true;
    }),
  );
  if (mutated && (options.syncRunHealth ?? draft.session.activity.kind !== "inactive")) {
    rebindLiveRunMeta(draft);
  }
  return result;
}

export function dispatchGearSalvageWithMaterialGrant(
  mutate: (gear: GearStore) => ReturnType<GearDraftView["salvage"]>,
  options?: { syncRunHealth?: boolean | undefined },
): ReturnType<GearDraftView["salvage"]> {
  return dispatchRunSessionCommand((draft) => {
    const salvageResult = mutateGearWithRunHealthSync(draft, { mutate, syncRunHealth: options?.syncRunHealth });
    if (!salvageResult) return null;
    if (draft.session.activity.kind !== "inactive") {
      awardMaterialsDuringRun(draft, salvageResult.yieldedMaterials);
      addRunCurrenciesEarned(draft, salvageResult.yieldedCurrencies);
    } else {
      addMaterialsToStockpile(draft, salvageResult.yieldedMaterials);
    }
    return salvageResult;
  });
}
