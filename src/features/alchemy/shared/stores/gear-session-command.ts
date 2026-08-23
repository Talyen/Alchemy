// Aggregate command for permanent Gear mutations that affect the active run.
// Keeping the invariant here prevents Armory, shops, and reward flows from
// each implementing their own partial Gear → run-health synchronization.
import type { GearStore } from "./gear-store-types";
import {
  addGearCurrencies,
  addGearInstance,
  applyGearCurrency,
  equipGearInstance,
  initializeGear,
  resetGear,
  salvageGearInstance,
  unequipGearInstance,
} from "./gear-actions";
import { dispatchRunSessionCommand, type GameplayDraft } from "./run-session-command";
import { addMaterials, awardMaterialsDuringRun } from "./run-session-write-port";
import { syncRunMaxHealthFromGearMutation } from "./run-session-lifecycle-port";

function gearCommandView(state: GameplayDraft): GearStore {
  const gear = state.gear;
  return {
    ...gear,
    initialize: (inventories, loadouts, craftingCurrencies) =>
      initializeGear(gear, inventories, loadouts, craftingCurrencies),
    addInstance: (instance, characterId) => addGearInstance(gear, instance, characterId),
    equip: (characterId, slot, instance) => equipGearInstance(gear, characterId, slot, instance),
    unequip: (characterId, slot) => unequipGearInstance(gear, characterId, slot),
    salvage: (instanceId, options) => salvageGearInstance(gear, instanceId, options),
    applyCurrency: (currencyId, instanceId, options) => applyGearCurrency(gear, currencyId, instanceId, options),
    addCurrencies: (currencies) => addGearCurrencies(gear, currencies),
    reset: () => resetGear(gear),
  };
}

export function dispatchGearMutationWithRunHealthSync<T>(options: {
  mutate: (gear: GearStore) => T;
  syncRunHealth?: boolean;
}): T {
  return dispatchRunSessionCommand((draft) => mutateGearWithRunHealthSync(draft, options));
}

export function mutateGearWithRunHealthSync<T>(
  draft: GameplayDraft,
  options: {
    mutate: (gear: GearStore) => T;
    syncRunHealth?: boolean;
  },
): T {
  const result = options.mutate(gearCommandView(draft));
  if (options.syncRunHealth ?? draft.session.hasActiveRun) {
    syncRunMaxHealthFromGearMutation(draft);
  }
  return result;
}

export function dispatchGearSalvageWithMaterialGrant(
  mutate: (gear: GearStore) => ReturnType<GearStore["salvage"]>,
): ReturnType<GearStore["salvage"]> {
  return dispatchRunSessionCommand((draft) => {
    const salvageResult = mutateGearWithRunHealthSync(draft, { mutate });
    if (!salvageResult) return null;
    if (draft.session.hasActiveRun) {
      awardMaterialsDuringRun(draft, salvageResult.yieldedMaterials);
    } else {
      addMaterials(draft, salvageResult.yieldedMaterials);
    }
    return salvageResult;
  });
}
