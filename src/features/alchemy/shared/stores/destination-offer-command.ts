import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/run-session-command";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { createInitialDestinationResult } from "@/features/alchemy/shared/run-flow/destination-flow";
import { selectHasAnyOwnedGear, selectHasUnownedTrinkets } from "./gear-store";
import {
  resolveAvailableDestinations,
  type DestinationEligibilityContext,
} from "../run-flow/resolve-available-destinations";
import type { RunTransaction } from "./run-session-command";
import {
  createDraftRunRandomSource,
  setDestinationOfferState,
  setRewardState,
  setRunProgressActivity,
} from "./run-session-write-port";

export function readDraftDestinationEligibility(draft: RunTransaction): DestinationEligibilityContext {
  const run = draft.run.activeRun;
  return {
    currentAct: run.currentAct,
    destinationIndexInAct: run.destinationIndexInAct,
    completedDestinations: run.completedDestinations,
    hasAnyOwnedGear: selectHasAnyOwnedGear(draft.gear),
    hasUnownedTrinkets: selectHasUnownedTrinkets(draft.gear),
  };
}

export function resolveDraftAvailableDestinations(draft: RunTransaction) {
  return resolveAvailableDestinations({
    ...readDraftDestinationEligibility(draft),
    runPlayerHealth: draft.run.activeRun.runPlayerHealth,
    gold: draft.runProfile.gold,
    runMaxHealth: draft.run.activeRun.runMaxHealth,
  });
}

// Run start and progression share this recipe inside their existing command,
// keeping the offer history, reward state, and RNG counters in one commit.
export function sampleAndApplyDestinationOffer(draft: RunTransaction): void {
  const run = draft.run.activeRun;
  const result = createInitialDestinationResult({
    availableDestinations: resolveDraftAvailableDestinations(draft),
    offerState: {
      lastOfferedDestinations: snapshotTransactionValue(run.lastOfferedDestinations),
      roundsSinceOffered: run.destinationRoundsSinceOffered,
    },
    rollBossEnemyId: () => rollFreshBossId(createDraftRunRandomSource(draft, "world")),
    rng: createDraftRunRandomSource(draft, "destinations"),
  });
  setDestinationOfferState(draft, result.offerState);
  setRewardState(draft, result.rewardState);
  setRunProgressActivity(draft, "destination");
}
