import type { RunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { useRunSessionNavigationSlice } from "@/features/alchemy/shared/stores/run-reads";
import { useMemo } from "react";
import { createRunFlowEngine } from "./run-flow-engine";
import type { RunNavigationDeps } from "./shell-types";

export function useRunFlowEngine(
  { screen, navigateTo, transition, cancelPending, battle, initializeShop, labyrinthClearNode }: RunNavigationDeps,
  outcomes: RunOutcomes,
) {
  const nav = useRunSessionNavigationSlice(screen);
  const commands = useMemo(
    () =>
      createRunFlowEngine(
        { navigateTo, transition, cancelPending, battle, initializeShop, labyrinthClearNode },
        outcomes,
      ),
    [navigateTo, transition, cancelPending, battle, initializeShop, labyrinthClearNode, outcomes],
  );

  return useMemo(
    () => ({
      ...commands,
      runPhase: nav.phase,
      activeRunData: nav.hasActiveRun,
      pendingCharacterId: nav.pendingCharacterId,
    }),
    [commands, nav.phase, nav.hasActiveRun, nav.pendingCharacterId],
  );
}
