// Aggregate command for permanent Gear mutations that affect the active run.
// Keeping the invariant here prevents Armory, shops, and reward flows from
// each implementing their own partial Gear → run-health synchronization.
import type { CharacterId } from "@/lib/game-data";
import type { GearInstance, GearLoadouts } from "@/lib/gear";
import type { GearStore } from "./gear-store-types";
import { createGameplayDraftGearActions } from "./gameplay-state-store";
import { dispatchRunSessionCommand, type GameplayDraft } from "./run-session-command";
import { addMaterials, awardMaterialsDuringRun } from "./run-session-write-port";
import { syncRunMaxHealthFromGearMutation } from "./run-session-lifecycle-port";

export interface GearHealthSnapshot {
  inventories: GearInstance[];
  loadouts: GearLoadouts;
}

function gearCommandView(state: GameplayDraft): GearStore {
  const actions = createGameplayDraftGearActions(state);
  return {
    ...state.gear,
    initialize: actions.gearInitialize,
    addInstance: actions.gearAddInstance,
    equip: actions.gearEquip,
    unequip: actions.gearUnequip,
    salvage: actions.gearSalvage,
    applyCurrency: actions.gearApplyCurrency,
    addCurrencies: actions.gearAddCurrencies,
    reset: actions.gearReset,
  };
}

export function dispatchGearMutationWithRunHealthSync<T>(options: {
  characterId: CharacterId;
  mutate: (gear: GearStore) => T;
  before?: GearHealthSnapshot;
  syncRunHealth?: boolean;
}): T {
  return dispatchRunSessionCommand((draft) => mutateGearWithRunHealthSync(draft, options));
}

export function mutateGearWithRunHealthSync<T>(
  draft: GameplayDraft,
  options: {
    characterId: CharacterId;
    mutate: (gear: GearStore) => T;
    before?: GearHealthSnapshot;
    syncRunHealth?: boolean;
  },
): T {
  void options.before;
  const result = options.mutate(gearCommandView(draft));
  if (options.syncRunHealth ?? draft.session.hasActiveRun) {
    syncRunMaxHealthFromGearMutation(draft);
  }
  return result;
}

export function dispatchGearSalvageWithMaterialGrant(
  characterId: CharacterId,
  mutate: (gear: GearStore) => ReturnType<GearStore["salvage"]>,
): ReturnType<GearStore["salvage"]> {
  return dispatchRunSessionCommand((draft) => {
    const salvageResult = mutateGearWithRunHealthSync(draft, { characterId, mutate });
    if (!salvageResult) return null;
    if (draft.session.hasActiveRun) {
      awardMaterialsDuringRun(draft, salvageResult.yieldedMaterials);
    } else {
      addMaterials(draft, salvageResult.yieldedMaterials);
    }
    return salvageResult;
  });
}
