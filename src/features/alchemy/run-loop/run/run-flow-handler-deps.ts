import type { MaterialInventory } from "@/lib/homestead/types";
import type { Destination } from "@/lib/routing";
import type { RunFlowShellActions } from "./run-flow-shell-actions";

export type CompleteRunVictory = (
  displayMaterials?: MaterialInventory | null,
  onRenderedScreenCommit?: () => void,
) => void;

export type HandleActComplete = (displayMaterials?: MaterialInventory, onRenderedScreenCommit?: () => void) => void;

export type AdvanceToNextDestination = () => void;

export interface RunFlowHandlerDeps {
  /** Shell-executed side effects (navigate, shops, battle starts, content hooks). */
  actions: RunFlowShellActions;
  getAvailableDestinations: (options?: {
    currentHealth?: number;
    currentGold?: number;
    destinationIndexInAct?: number;
    maxHealth?: number;
  }) => Destination[];
}
