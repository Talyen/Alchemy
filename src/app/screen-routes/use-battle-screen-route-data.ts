// Route-local battle display reads — keeps presentation/display out of routeCommands.
import { useMemo } from "react";
import {
  useActiveRunScreenValue,
  useActiveRunBoons,
  useDisplayOverrides,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useRunSessionBattleContext } from "@/features/alchemy/shared/stores/run-session-model";
import type { BattleScreenData } from "@/features/alchemy/run-loop/screens/battle-screen/types";

export function useBattleScreenRouteData() {
  const screen = useActiveRunScreenValue();
  const {
    battle: { battleState, hasActiveBattle },
    activeLabyrinthModifiers,
  } = useRunSessionBattleContext(screen);
  const displayOverrides = useDisplayOverrides();
  const runBoons = useActiveRunBoons();
  const battleScreenData: BattleScreenData = useMemo(
    () => ({
      battleState,
      displayOverrides,
      activeLabyrinthModifiers,
      runBoons,
    }),
    [battleState, displayOverrides, activeLabyrinthModifiers, runBoons],
  );

  return {
    battleScreenData,
    hasActiveBattle,
  };
}
