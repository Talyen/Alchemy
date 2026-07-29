// Thin React wiring around createRunFlowHandlers.
import { useMemo } from "react";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import type { RunFlowHandlerDeps } from "@/features/alchemy/run-loop/run/run-flow-handler-deps";

export function useRunFlowHandlers({
  run,
  talents,
  dispatch,
  contentNav,
  getAvailableDestinations,
  rewardRng,
  destinationRng,
  worldRng,
}: RunFlowHandlerDeps) {
  return useMemo(
    () =>
      createRunFlowHandlers({
        run,
        talents,
        dispatch,
        contentNav,
        getAvailableDestinations,
        rewardRng,
        destinationRng,
        worldRng,
      }),
    [run, talents, dispatch, contentNav, getAvailableDestinations, rewardRng, destinationRng, worldRng],
  );
}
