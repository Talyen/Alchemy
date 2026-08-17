import type { MaterialInventory } from "@/lib/homestead/types";
import type { Destination } from "@/lib/routing";
import type { RunFlowShellActions } from "./run-flow-shell-actions";
import type { RunFlowRunPort, RunFlowTalentPort } from "@/features/alchemy/shared/stores/run-port-types";

export type CompleteRunVictory = (
  displayMaterials?: MaterialInventory | null,
  onRenderedScreenCommit?: () => void,
) => void;

export type HandleActComplete = (displayMaterials?: MaterialInventory, onRenderedScreenCommit?: () => void) => void;

export type AdvanceToNextDestination = () => void;

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
