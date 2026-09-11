import { createRunOutcomes, type RunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { useRunSessionNavigationSlice } from "@/features/alchemy/shared/stores/run-reads";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useMemo } from "react";
import { getRunAvailableDestinations } from "./run-destination-wiring";
import { createRunFlowEngine } from "./run-flow-engine";
import type { RunNavigationDeps } from "./shell-types";

export function useRunFlowEngine(
  { screen, navigateTo, transition, cancelPending, battle, initializeShop, labyrinthClearNode }: RunNavigationDeps,
  outcomes?: RunOutcomes,
) {
  const nav = useRunSessionNavigationSlice(screen);
  const commands = useMemo(
    () =>
      createRunFlowEngine(
        { navigateTo, transition, cancelPending, battle, initializeShop, labyrinthClearNode },
        outcomes ??
          createRunOutcomes({
            actions: { navigateTo, transition, clearCardHover: () => useUiStore.getState().clearCardHover() },
            getAvailableDestinations: getRunAvailableDestinations,
          }),
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
