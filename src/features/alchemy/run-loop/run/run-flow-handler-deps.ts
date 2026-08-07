import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { MaterialInventory } from "@/lib/homestead/types";
import type {
  DestinationOptionsInput,
  InitialDestinationResult,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import { readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import { CONSTANTS, type Destination } from "../../shared/types";
import type { RunFlowShellActions } from "./run-flow-shell-actions";
import type { RunFlowRunPort, RunFlowTalentPort } from "@/features/alchemy/shared/stores/run-port-types";

/** Sibling handlers that run-flow concerns call directly (filled after concern factories return). */
export interface RunFlowSiblingHandlers {
  prepareDestinationScreen: () => void;
  completeRunVictory: (displayMaterials?: MaterialInventory | null, onRenderedScreenCommit?: () => void) => void;
  handleActComplete: (displayMaterials?: MaterialInventory, onRenderedScreenCommit?: () => void) => void;
  advanceToNextDestination: () => void;
}

export interface RunFlowHandlerDeps {
  run: RunFlowRunPort;
  talents: RunFlowTalentPort;
  /** Shell-executed side effects (navigate, shops, battle starts, content hooks). */
  actions: RunFlowShellActions;
  contentNav: {
    createInitialDestinations: (options?: DestinationOptionsInput) => InitialDestinationResult;
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
  const session = readRunSession();
  if (contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
    return session.wildwoodDraft?.currentRewardTraitIds ?? [];
  }
  return session.activeLabyrinthRewardModifiers;
}
