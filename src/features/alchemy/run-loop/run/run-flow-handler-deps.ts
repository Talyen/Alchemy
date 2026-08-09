import type { MaterialInventory } from "@/lib/homestead/types";
import type { Destination } from "../../shared/types";
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
  getAvailableDestinations: (options?: {
    currentHealth?: number;
    currentGold?: number;
    destinationIndexInAct?: number;
    maxHealth?: number;
  }) => Destination[];
}
