import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";

/** Shared mutable bag so concern modules can call siblings at runtime after the composer wires them. */
export interface RunFlowContext {
  deps: RunFlowHandlerDeps;
  prepareDestinationScreen: () => void;
  completeRunVictory: (displayMaterials?: MaterialInventory | null, onRenderedScreenCommit?: () => void) => void;
  handleActComplete: (displayMaterials?: MaterialInventory) => void;
  advanceToNextDestination: () => void;
  endLabyrinthRun: () => void;
  endRunAndShowGameOver: () => void;
}

export function createRunFlowContext(deps: RunFlowHandlerDeps): RunFlowContext {
  return {
    deps,
    prepareDestinationScreen: () => {},
    completeRunVictory: () => {},
    handleActComplete: () => {},
    advanceToNextDestination: () => {},
    endLabyrinthRun: () => {},
    endRunAndShowGameOver: () => {},
  };
}
