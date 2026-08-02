// Reward / claim session write port — reward UI state and claim guards.
import type { BattleCard } from "@/lib/game-data";
import type { RewardState } from "@/lib/active-run-session";
import type { Destination } from "@/features/alchemy/shared/types";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { CorruptionResult } from "@/lib/corruption";
import { dispatchRunSessionCommand } from "../run-session-command";
import { readGameplayState } from "../gameplay-state-store";

export function setRewardState(state: RewardState | ((prev: RewardState) => RewardState)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setRewardState(state));
}

export function setCompanionRewardCards(cards: BattleCard[] | null) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setCompanionRewardCards(cards));
}

export function beginRewardClaim(): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.beginRewardClaim());
}

export function releaseRewardClaim(): void {
  dispatchRunSessionCommand(() => readGameplayState().sessionActions.releaseRewardClaim());
}

export function beginDestinationClaim(destination: Destination): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.beginDestinationClaim(destination));
}

/** Commit destination claim across session + active-run progress (cross-lifetime). */
export function commitDestinationClaim(destination: Destination): boolean {
  return dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    const transient = session.session;
    if (transient.pendingDestinationClaim !== destination) return false;
    if (!transient.rewardState.destinations.includes(destination)) {
      session.sessionActions.cancelDestinationClaim();
      return false;
    }
    session.sessionActions.setRewardState((prev) => ({ ...prev, destinations: [] }));
    session.sessionActions.cancelDestinationClaim();
    session.runActions.setCompletedDestinations((prev) => [...prev, destination]);
    session.runActions.setDestinationIndexInAct((prev) => prev + 1);
    return true;
  });
}

export function cancelDestinationClaim(): void {
  dispatchRunSessionCommand(() => readGameplayState().sessionActions.cancelDestinationClaim());
}

export function setRunEndMaterials(materials: MaterialInventory) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setRunEndMaterials(materials));
}

export function setCorruptionResult(result: CorruptionResult | null) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setCorruptionResult(result));
}
