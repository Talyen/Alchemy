// Restore labyrinth / wildwood / reward / shop session fields from ActiveRunData.
import type { ActiveRunData } from "@/lib/active-run-session";
import { restorePendingReward, restoreWildwoodRewardState } from "@/lib/active-run-session";
import {
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  hydrateShopState,
  hydrateTrinketShopState,
} from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { SessionActions } from "./slices/session-slice";

/** Transient-session writers needed to rehydrate a persisted run. */
type SessionStore = Pick<
  SessionActions,
  | "setLabyrinthMap"
  | "setActiveLabyrinthModifiers"
  | "setActiveLabyrinthRewardModifiers"
  | "setActiveLabyrinthPendingNode"
  | "setRewardState"
  | "applyDestinationChoices"
  | "setShopState"
  | "setAlchemistState"
  | "setTrinketShopState"
  | "setEquipmentShopState"
>;

export function restoreLabyrinth(store: SessionStore, activeRun: ActiveRunData): void {
  if (activeRun.labyrinthMap) store.setLabyrinthMap(activeRun.labyrinthMap);
  if (activeRun.activeCombat) {
    store.setActiveLabyrinthModifiers(activeRun.activeCombat.activeLabyrinthModifiers);
    store.setActiveLabyrinthRewardModifiers(activeRun.activeCombat.activeLabyrinthRewardModifiers);
  }
  if (activeRun.labyrinthPendingNode) store.setActiveLabyrinthPendingNode(activeRun.labyrinthPendingNode);
}

export function restoreWildwoodReward(store: SessionStore, activeRun: ActiveRunData): void {
  const wildwoodDraft = activeRun.wildwoodDraft;
  if (!wildwoodDraft?.rewardType) return;
  if (wildwoodDraft.phase !== "reward" && wildwoodDraft.phase !== "recovery") return;
  store.setRewardState(
    restoreWildwoodRewardState(
      wildwoodDraft.rewardType,
      wildwoodDraft.rewardChoiceIds,
      wildwoodDraft.selectedRewardId,
      wildwoodDraft.rewardGearChoices,
    ),
  );
}

export function restoreReward(
  store: SessionStore,
  activeRun: ActiveRunData,
  setScreen: (screen: Screen) => void,
): void {
  if (activeRun.currentScreen === "destination" && activeRun.destinationChoices.length > 0) {
    store.applyDestinationChoices(activeRun.destinationChoices);
  } else if (activeRun.pendingReward) {
    const restored = restorePendingReward(activeRun.pendingReward);
    if (restored) {
      store.setRewardState(restored);
    } else {
      console.warn("Pending reward could not be restored; reward choices were dropped", {
        rewardType: activeRun.pendingReward.rewardType,
      });
      // Recover destinations when card/trinket IDs are gone but the route forward remains valid.
      if (activeRun.pendingReward.destinations.length > 0) {
        store.applyDestinationChoices(activeRun.pendingReward.destinations);
        setScreen("destination");
      }
    }
  } else if (activeRun.currentScreen === "rewards" && activeRun.destinationChoices.length > 0) {
    // Claim drained mid-transition; resume on destination pick with destinations intact.
    store.applyDestinationChoices(activeRun.destinationChoices);
    setScreen("destination");
  }
}

export function restoreShops(store: SessionStore, activeRun: ActiveRunData): void {
  if (activeRun.shopState) store.setShopState(hydrateShopState(activeRun.shopState));
  if (activeRun.alchemistState) store.setAlchemistState(hydrateAlchemistState(activeRun.alchemistState));
  if (activeRun.trinketShopState) store.setTrinketShopState(hydrateTrinketShopState(activeRun.trinketShopState));
  if (activeRun.equipmentShopState)
    store.setEquipmentShopState(hydrateEquipmentShopState(activeRun.equipmentShopState));
}
