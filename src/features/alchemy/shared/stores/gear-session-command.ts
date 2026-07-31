// Aggregate command for permanent Gear mutations that affect the active run.
// Keeping the invariant here prevents Armory, shops, and reward flows from
// each implementing their own partial Gear → run-health synchronization.
import type { CharacterId } from "@/lib/game-data";
import { flattenGearInventories, type GearInstance, type GearLoadouts } from "@/lib/gear";
import type { GearStore } from "./gear-store-types";
import { useGearStore } from "./gear-store";
import { getRunTransientStore } from "./run-transient-store";
import { dispatchRunSessionCommand } from "./run-session-command";
import { syncRunMaxHealthFromGearMutation } from "./run-transitions";

export interface GearHealthSnapshot {
  inventories: GearInstance[];
  loadouts: GearLoadouts;
}

export function snapshotGearHealth(
  state: Pick<GearStore, "inventories" | "loadouts"> = useGearStore.getState(),
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
    const result = options.mutate(useGearStore.getState());
    if (options.syncRunHealth ?? getRunTransientStore().hasActiveRun) {
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
