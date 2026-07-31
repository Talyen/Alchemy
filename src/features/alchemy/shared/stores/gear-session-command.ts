// Aggregate command for permanent Gear mutations that affect the active run.
// Keeping the invariant here prevents Armory, shops, and reward flows from
// each implementing their own partial Gear → run-health synchronization.
import type { CharacterId } from "@/lib/game-data";
import { flattenGearInventories, type GearInstance, type GearLoadouts } from "@/lib/gear";
import type { GearStore } from "./gear-store-types";
import { readGameplayState } from "./gameplay-state-store";
import { dispatchRunSessionCommand } from "./run-session-command";
import { createRunSessionStoreSnapshot } from "./run-session-queries";
import { syncRunMaxHealthFromGearMutation } from "./run-transitions";

export interface GearHealthSnapshot {
  inventories: GearInstance[];
  loadouts: GearLoadouts;
}

function snapshotGearHealth(
  state: Pick<GearStore, "inventories" | "loadouts"> = createRunSessionStoreSnapshot().gear,
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
  return dispatchRunSessionCommand(() => {
    const before = options.before ?? snapshotGearHealth();
    const result = options.mutate(createRunSessionStoreSnapshot().gear);
    if (options.syncRunHealth ?? readGameplayState().session.hasActiveRun) {
      const after = snapshotGearHealth();
      syncRunMaxHealthFromGearMutation(
        options.characterId,
        before.inventories,
        before.loadouts,
        after.inventories,
        after.loadouts,
      );
    }
    return result;
  });
}
