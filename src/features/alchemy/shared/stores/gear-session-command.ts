import { gearDefinitions } from "@/lib/gear";
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
  unequipGearInstance,
  unequipPermanentTrinket,
} from "./gear-actions";
import { discoverUniqueIds } from "./profile-store";
import { dispatchRunSessionCommand, type GameplayDraft } from "./run-session-command";
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
    equip: (characterId, slot, instance) => equipGearInstance(gear, characterId, slot, instance),
    unequip: (characterId, slot) => unequipGearInstance(gear, characterId, slot),
    addTrinket: (trinketId) => addPermanentTrinket(gear, trinketId),
    equipTrinket: (characterId, trinketId) => equipPermanentTrinket(gear, characterId, trinketId),
    unequipTrinket: (characterId) => unequipPermanentTrinket(gear, characterId),
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
    syncRunHealth?: boolean | undefined;
  },
): T {
  const result = options.mutate(gearCommandView(draft));
  if (options.syncRunHealth ?? draft.session.hasActiveRun) {
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
