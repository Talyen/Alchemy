// Side-effect: registers presentation cleanup with the shared bridge.
import "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useRunFlowEngine } from "./use-run-flow-engine";
import type { RunNavigationDeps } from "./shell-types";

export function useRunNavigation(deps: RunNavigationDeps) {
  return useRunFlowEngine(deps);
}
