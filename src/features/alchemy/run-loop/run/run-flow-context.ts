import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";

/**
 * Continuations between run-flow concerns.
 *
 * These are deliberately explicit instead of hidden sibling callbacks. A
 * concern can request the next run-flow operation without owning another
 * concern's handler or depending on construction order.
 */
export type RunFlowContinuation =
  | { type: "prepare-destination-screen" }
  | {
      type: "complete-run-victory";
      displayMaterials?: MaterialInventory | null;
      onRenderedScreenCommit?: () => void;
    }
  | {
      type: "handle-act-complete";
      displayMaterials?: MaterialInventory;
      onRenderedScreenCommit?: () => void;
    }
  | { type: "advance-to-next-destination" };

export interface RunFlowContext {
  deps: RunFlowHandlerDeps;
  dispatchContinuation: (continuation: RunFlowContinuation) => void;
}

export function createRunFlowContext(
  deps: RunFlowHandlerDeps,
  dispatchContinuation: (continuation: RunFlowContinuation) => void,
): RunFlowContext {
  return { deps, dispatchContinuation };
}
