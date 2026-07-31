// Reward / claim session write port — reward UI state and claim guards.
import type { BattleCard } from "@/lib/game-data";
import type { RewardState } from "@/lib/active-run-session";
import type { Destination } from "@/features/alchemy/shared/types";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { CorruptionResult } from "@/lib/corruption";
import { dispatchRunSessionCommand } from "../run-session-command";
import { createRunSessionStoreSnapshot } from "../run-session-queries";

export function setRewardState(state: RewardState | ((prev: RewardState) => RewardState)) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setRewardState(state));
}

export function setCompanionRewardCards(cards: BattleCard[] | null) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setCompanionRewardCards(cards));
}

export function beginRewardClaim(): boolean {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.beginRewardClaim());
}

export function releaseRewardClaim(): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.releaseRewardClaim());
}

export function beginDestinationClaim(destination: Destination): boolean {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.beginDestinationClaim(destination));
}

/** Commit destination claim across session + active-run progress (cross-lifetime). */
export function commitDestinationClaim(destination: Destination): boolean {
  return dispatchRunSessionCommand(() => {
    const session = createRunSessionStoreSnapshot();
    const transient = session.transient;
    if (transient.pendingDestinationClaim !== destination) return false;
    if (!transient.rewardState.destinations.includes(destination)) {
      transient.cancelDestinationClaim();
      return false;
    }
    transient.setRewardState((prev) => ({ ...prev, destinations: [] }));
    transient.cancelDestinationClaim();
    const run = session.domain;
    run.setCompletedDestinations((prev) => [...prev, destination]);
    run.setDestinationIndexInAct((prev) => prev + 1);
    return true;
  });
}

export function cancelDestinationClaim(): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.cancelDestinationClaim());
}

export function setRunEndMaterials(materials: MaterialInventory) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setRunEndMaterials(materials));
}

export function setCorruptionResult(result: CorruptionResult | null) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setCorruptionResult(result));
}
