// Restore labyrinth / wildwood / reward / shop session fields from ActiveRunData.
import type { ActiveRunData } from "@/lib/active-run-session";
import { restorePendingReward, restoreWildwoodRewardState } from "@/lib/active-run-session";
import {
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  hydrateShopState,
  hydrateTrinketShopState,
} from "@/lib/active-run-session";
import type { getRunDomainStore } from "./run-domain-store";

type DomainStore = ReturnType<typeof getRunDomainStore>;

export function restoreLabyrinth(store: DomainStore, activeRun: ActiveRunData): void {
  if (activeRun.labyrinthMap) store.setLabyrinthMap(activeRun.labyrinthMap);
  if (activeRun.activeCombat) {
    store.setActiveLabyrinthModifiers(activeRun.activeCombat.activeLabyrinthModifiers);
    store.setActiveLabyrinthRewardModifiers(activeRun.activeCombat.activeLabyrinthRewardModifiers);
  }
  if (activeRun.labyrinthPendingNode) store.setActiveLabyrinthPendingNode(activeRun.labyrinthPendingNode);
}

export function restoreWildwoodReward(store: DomainStore, activeRun: ActiveRunData): void {
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

export function restoreReward(store: DomainStore, activeRun: ActiveRunData): void {
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
        store.setScreen("destination");
      }
    }
  } else if (activeRun.currentScreen === "rewards" && activeRun.destinationChoices.length > 0) {
    // Claim drained mid-transition; resume on destination pick with destinations intact.
    store.applyDestinationChoices(activeRun.destinationChoices);
    store.setScreen("destination");
  }
}

export function restoreShops(store: DomainStore, activeRun: ActiveRunData): void {
  if (activeRun.shopState) store.setShopState(hydrateShopState(activeRun.shopState));
  if (activeRun.alchemistState) store.setAlchemistState(hydrateAlchemistState(activeRun.alchemistState));
  if (activeRun.trinketShopState) store.setTrinketShopState(hydrateTrinketShopState(activeRun.trinketShopState));
  if (activeRun.equipmentShopState)
    store.setEquipmentShopState(hydrateEquipmentShopState(activeRun.equipmentShopState));
}
