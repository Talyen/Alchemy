import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { RewardState } from "@/lib/active-run-session";
import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow/destination-flow";
import { readRunSessionStore } from "../../shared/stores/run-session-facade";
import { CONSTANTS, type Destination } from "../../shared/types";
import type { RunFlowDispatch } from "./run-flow-intents";
import type { RunFlowRunPort, RunFlowTalentPort } from "./run-flow-ports";

export interface RunFlowHandlerDeps {
  run: RunFlowRunPort;
  talents: RunFlowTalentPort;
  /** Shell-executed side effects (navigate, shops, battle starts, content hooks). */
  dispatch: RunFlowDispatch;
  contentNav: {
    createInitialDestinations: (options?: DestinationOptionsInput) => RewardState;
  };
  getAvailableDestinations: (options?: {
    currentHealth?: number;
    currentGold?: number;
    destinationIndexInAct?: number;
    maxHealth?: number;
  }) => Destination[];
  rewardRng: () => number;
  destinationRng: () => number;
  worldRng: () => number;
}

export function getActiveRewardTraits(contentSystemType: ContentSystemId): EncounterRewardTraitId[] {
  const session = readRunSessionStore();
  if (contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
    return session.wildwoodDraft?.currentRewardTraitIds ?? [];
  }
  return session.activeLabyrinthRewardModifiers;
}
