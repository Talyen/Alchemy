// Route-local battle display reads — keeps presentation/display out of routeCommands.
import { useMemo } from "react";
import {
  useActiveRunScreenValue,
  useActiveRunTrinkets,
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
  const runTrinkets = useActiveRunTrinkets();
  const battleScreenData: BattleScreenData = useMemo(
    () => ({
      battleState,
      displayOverrides,
      activeLabyrinthModifiers,
      runTrinkets,
    }),
    [battleState, displayOverrides, activeLabyrinthModifiers, runTrinkets],
  );

  return {
    battleScreenData,
    hasActiveBattle,
  };
}
