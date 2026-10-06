import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useMemo, useState } from "react";
import { useActiveRunScreenValue, useActiveRunBoons } from "@/features/alchemy/shared/stores/run-reads";
import { useRunSessionBattleContext } from "@/features/alchemy/shared/stores/run-reads";
import type { BattleScreenData } from "@/features/alchemy/run-loop/screens/battle-screen/types";

export function useBattleScreenRouteData() {
  const screen = useActiveRunScreenValue();
  const {
    battle: { battleState, hasActiveBattle },
    activeLabyrinthModifiers,
  } = useRunSessionBattleContext(screen);
  const displayedBattle = useBattlePresentationStore((state) => state.displayedBattle);
  const runBoons = useActiveRunBoons();
  const battleScreenData: BattleScreenData = useMemo(
    () => ({
      battleState: displayedBattle ?? battleState,
      activeLabyrinthModifiers,
      runBoons,
    }),
    [battleState, displayedBattle, activeLabyrinthModifiers, runBoons],
  );

  // Settlement removes combat immediately; the outgoing route keeps its final
  // display through the victory delay and fade, just like other activity routes.
  const [shown, setShown] = useState(battleScreenData);
  if (hasActiveBattle && shown !== battleScreenData) setShown(battleScreenData);
  else if (!hasActiveBattle && displayedBattle !== null && shown.battleState !== displayedBattle)
    setShown({ ...shown, battleState: displayedBattle });

  return {
    battleScreenData: hasActiveBattle ? battleScreenData : shown,
    hasActiveBattle,
  };
}
