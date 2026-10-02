import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { createInitialDestinationResult } from "@/features/alchemy/shared/run-flow/destination-flow";
import type { Destination } from "@/lib/routing";
import type { GameplayDraft } from "./run-session-command";
import { createDraftRunRandomSource, setDestinationOfferState, setRewardState } from "./run-session-write-port";

// Run start and progression share this recipe inside their existing command,
// keeping the offer history, reward state, and RNG counters in one commit.
export function sampleAndApplyDestinationOffer(draft: GameplayDraft, availableDestinations: Destination[]): void {
  const run = draft.run.activeRun;
  const result = createInitialDestinationResult({
    availableDestinations,
    offerState: {
      lastOfferedDestinations: run.lastOfferedDestinations,
      roundsSinceOffered: run.destinationRoundsSinceOffered,
    },
    rollBossEnemyId: () => rollFreshBossId(createDraftRunRandomSource(draft, "world")),
    rng: createDraftRunRandomSource(draft, "destinations"),
  });
  setDestinationOfferState(draft, result.offerState);
  setRewardState(draft, result.rewardState);
}
