// Aggregate command for permanent Gear mutations that affect the active run.
// Keeping the invariant here prevents Armory, shops, and reward flows from
// each implementing their own partial Gear → run-health synchronization.
import type { CharacterId } from "@/lib/game-data";
import { flattenGearInventories, type GearInstance, type GearLoadouts } from "@/lib/gear";
import type { GearStore } from "./gear-store-types";
import { createGameplayDraftGearActions, readGameplayState } from "./gameplay-state-store";
import { dispatchRunSessionCommand } from "./run-session-command";
import { syncRunMaxHealthFromGearMutation } from "./run-transitions";
import type { GameplayDraft } from "./run-session-command";

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
  const before = options.before ?? snapshotGearHealth(draft.gear);
  const result = options.mutate(gearCommandView(draft));
  if (options.syncRunHealth ?? draft.session.hasActiveRun) {
    const after = snapshotGearHealth(draft.gear);
    syncRunMaxHealthFromGearMutation(
      draft,
      options.characterId,
      before.inventories,
      before.loadouts,
      after.inventories,
      after.loadouts,
    );
  }
  return result;
}
