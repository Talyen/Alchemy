// Aggregate command for permanent Gear mutations that affect the active run.
// Keeping the invariant here prevents Armory, shops, and reward flows from
// each implementing their own partial Gear → run-health synchronization.
import type { CharacterId } from "@/lib/game-data";
import { flattenGearInventories, type GearInstance, type GearLoadouts } from "@/lib/gear";
import type { GearStore } from "./gear-store-types";
import { createGameplayDraftActions, readGameplayState } from "./gameplay-state-store";
import { dispatchRunSessionCommand } from "./run-session-command";
import { syncRunMaxHealthFromGearMutation } from "./run-transitions";
import type { GameplayDraft } from "./run-session-command";

export interface GearHealthSnapshot {
  inventories: GearInstance[];
  loadouts: GearLoadouts;
}

function gearCommandView(state: GameplayDraft): GearStore {
  const actions = createGameplayDraftActions(state).gearActions;
  return {
    ...state.gear,
    initialize: actions.gearInitialize,
    addInstance: actions.gearAddInstance,
    transferToInventory: actions.gearTransferToInventory,
    equip: actions.gearEquip,
    unequip: actions.gearUnequip,
    moveBoardItem: actions.gearMoveBoardItem,
    syncBoardPositions: actions.gearSyncBoardPositions,
    sortBoard: actions.gearSortBoard,
    salvage: actions.gearSalvage,
    applyCurrency: actions.gearApplyCurrency,
    addCurrencies: actions.gearAddCurrencies,
    reset: actions.gearReset,
  };
}

function snapshotGearHealth(
  state: Pick<GearStore, "inventories" | "loadouts"> = readGameplayState().gear,
): GearHealthSnapshot {
  return {
    // Flattening creates a stable array before the command starts. Gear
    // mutations replace inventory arrays/items rather than mutating instances.
    inventories: flattenGearInventories(state.inventories),
    loadouts: Object.fromEntries(
      Object.entries(state.loadouts).map(([characterId, loadout]) => [characterId, { ...loadout }]),
    ) as GearLoadouts,
  };
}

export function dispatchGearMutationWithRunHealthSync<T>(options: {
  characterId: CharacterId;
  mutate: (gear: GearStore) => T;
  before?: GearHealthSnapshot;
  syncRunHealth?: boolean;
  draft?: GameplayDraft;
}): T {
  const applyMutation = (state: GameplayDraft): T => {
    const before = options.before ?? snapshotGearHealth(state.gear);
    const result = options.mutate(gearCommandView(state));
    if (options.syncRunHealth ?? state.session.hasActiveRun) {
      const after = snapshotGearHealth(state.gear);
      syncRunMaxHealthFromGearMutation(
        state,
        options.characterId,
        before.inventories,
        before.loadouts,
        after.inventories,
        after.loadouts,
      );
    }
    return result;
  };

  if (options.draft) return applyMutation(options.draft);
  return dispatchRunSessionCommand((draft) => applyMutation(draft));
}
