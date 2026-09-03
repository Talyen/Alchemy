import type { Destination } from "@/lib/routing";
import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import type { RunFlowShellActions } from "./run-flow-shell-actions";

export type CompleteRunVictory = (onRenderedScreenCommit?: () => void) => void;

export type HandleActComplete = (onRenderedScreenCommit?: () => void) => void;

export type AdvanceToNextDestination = () => void;

export interface RunFlowHandlerDeps {
  actions: RunFlowShellActions;
  getAvailableDestinations: (options?: DestinationOptionsInput) => Destination[];
}
