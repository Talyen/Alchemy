import { gearDefinitions } from "@/lib/gear";
import { current } from "immer";
import { deriveGearCombatRestrictions } from "./gear-combat-restrictions";
import type { GearStore } from "./gear-store-types";
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
  setGearProtected,
  unequipGearInstance,
  unequipPermanentTrinket,
} from "./gear-actions";
import { discoverUniqueIds } from "./profile-store";
import { dispatchRunSessionCommand, type GameplayDraft, type SynchronousResult } from "./run-session-command";
import { grantSalvageMaterials } from "./write-port-homestead";
import { rebindLiveRunMeta } from "./run-meta-rebind";

function gearCommandView(state: GameplayDraft): GearStore {
  const gear = state.gear;
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
    initialize: (inventories, loadouts, craftingCurrencies, ownedTrinketIds, equippedTrinkets) =>
      initializeGear(gear, inventories, loadouts, craftingCurrencies, ownedTrinketIds, equippedTrinkets),
    addInstance: (instance, characterId) => {
      addGearInstance(gear, instance, characterId);
      if (gearDefinitions[instance.definitionId]?.rarity === "unique") {
        discoverUniqueIds(state, [instance.definitionId]);
      }
    },
    equip: (characterId, slot, instance) => {
      const restrictions = deriveGearCombatRestrictions(state);
      if (restrictions.characters[characterId] || restrictions.gear[instance.instanceId]) return false;
      return equipGearInstance(gear, characterId, slot, instance);
    },
    unequip: (characterId, slot) => {
      if (deriveGearCombatRestrictions(state).characters[characterId]) return false;
      return unequipGearInstance(gear, characterId, slot);
    },
    addTrinket: (trinketId) => addPermanentTrinket(gear, trinketId),
    equipTrinket: (characterId, trinketId) => {
      const restrictions = deriveGearCombatRestrictions(state);
      if (restrictions.characters[characterId] || restrictions.trinkets[trinketId]) return false;
      return equipPermanentTrinket(gear, characterId, trinketId);
    },
    unequipTrinket: (characterId) => {
      if (deriveGearCombatRestrictions(state).characters[characterId]) return false;
      return unequipPermanentTrinket(gear, characterId);
    },
    setProtected: (instanceId, protectedItem) => {
      if (deriveGearCombatRestrictions(state).gear[instanceId]) return false;
      return setGearProtected(gear, instanceId, protectedItem);
    },
    salvage: (instanceId, options) => {
      if (deriveGearCombatRestrictions(state).gear[instanceId]) return null;
      return salvageGearInstance(gear, instanceId, options);
    },
    applyCurrency: (currencyId, instanceId, options) => {
      if (deriveGearCombatRestrictions(state).gear[instanceId]) return false;
      return applyGearCurrency(gear, currencyId, instanceId, options);
    },
    addCurrencies: (currencies) => addGearCurrencies(gear, currencies),
    reset: () => resetGear(gear),
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
  const before = current(draft.gear);
  const result = options.mutate(gearCommandView(draft));
  if (current(draft.gear) !== before && (options.syncRunHealth ?? draft.session.hasActiveRun)) {
    rebindLiveRunMeta(draft);
  }
  return result;
}

export function dispatchGearSalvageWithMaterialGrant(
  mutate: (gear: GearStore) => ReturnType<GearStore["salvage"]>,
  options?: { syncRunHealth?: boolean | undefined },
): ReturnType<GearStore["salvage"]> {
  return dispatchRunSessionCommand((draft) => {
    const salvageResult = mutateGearWithRunHealthSync(draft, { mutate, syncRunHealth: options?.syncRunHealth });
    if (!salvageResult) return null;
    grantSalvageMaterials(draft, salvageResult.yieldedMaterials);
    return salvageResult;
  });
}
