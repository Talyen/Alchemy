// Reward / claim session write port — reward UI state and claim guards.
import type { BattleCard } from "@/lib/game-data";
import type { RewardState } from "@/lib/active-run-session";
import type { Destination } from "@/features/alchemy/shared/types";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { CorruptionResult } from "@/lib/corruption";
import { getRunTransientStore } from "../run-transient-store";
import { getRunDomainStore } from "../run-domain-store";
import { runSessionTransaction } from "../run-session-transaction";

export function setRewardState(state: RewardState | ((prev: RewardState) => RewardState)) {
  getRunTransientStore().setRewardState(state);
}

export function setCompanionRewardCards(cards: BattleCard[] | null) {
  getRunTransientStore().setCompanionRewardCards(cards);
}

export function beginRewardClaim(): boolean {
  return getRunTransientStore().beginRewardClaim();
}

export function releaseRewardClaim(): void {
  getRunTransientStore().releaseRewardClaim();
}

export function beginDestinationClaim(destination: Destination): boolean {
  return getRunTransientStore().beginDestinationClaim(destination);
}

/** Commit destination claim across session + active-run progress (cross-lifetime). */
export function commitDestinationClaim(destination: Destination): boolean {
  return runSessionTransaction(() => {
    const transient = getRunTransientStore();
    if (transient.pendingDestinationClaim !== destination) return false;
    if (!transient.rewardState.destinations.includes(destination)) {
      transient.cancelDestinationClaim();
      return false;
    }
    transient.setRewardState((prev) => ({ ...prev, destinations: [] }));
    transient.cancelDestinationClaim();
    const run = getRunDomainStore();
    run.setCompletedDestinations((prev) => [...prev, destination]);
    run.setDestinationIndexInAct((prev) => prev + 1);
    return true;
  });
}

export function cancelDestinationClaim(): void {
  getRunTransientStore().cancelDestinationClaim();
}

export function setRunEndMaterials(materials: MaterialInventory) {
  getRunTransientStore().setRunEndMaterials(materials);
}

export function setCorruptionResult(result: CorruptionResult | null) {
  getRunTransientStore().setCorruptionResult(result);
}
