import type { MaterialInventory } from "@/lib/homestead/types";
import type { Destination } from "@/lib/routing";
import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import type { RunFlowShellActions } from "./run-flow-shell-actions";

export type CompleteRunVictory = (
  displayMaterials?: MaterialInventory | null,
  onRenderedScreenCommit?: () => void,
) => void;

export type HandleActComplete = (displayMaterials?: MaterialInventory, onRenderedScreenCommit?: () => void) => void;

export type AdvanceToNextDestination = () => void;

export interface RunFlowHandlerDeps {
  actions: RunFlowShellActions;
  getAvailableDestinations: (options?: DestinationOptionsInput) => Destination[];
}
