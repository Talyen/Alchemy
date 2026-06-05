// Memoized active-run snapshot for persistence and autosave.
import { useMemo } from "react";
import {
  useActiveRunScreenValue,
  useRunSessionBattleSlice,
  useRunSessionRunSlice,
  useRunSessionTransientSlice,
} from "../../shared/stores/run-session-facade";
import { buildActiveRunSnapshot } from "@/lib/active-run-session";

/** Builds ActiveRunData from run session slices (no full useRunSession subscription). */
export function useActiveRunSnapshot() {
  const screen = useActiveRunScreenValue();
  const run = useRunSessionRunSlice();
  const session = useRunSessionTransientSlice();
  const battle = useRunSessionBattleSlice();

  return useMemo(
    () =>
      buildActiveRunSnapshot({
        characterId: run.characterId,
        runDeck: run.runDeck,
        runGold: run.runGold,
        runPlayerHealth: run.runPlayerHealth,
        runMaxHealth: run.runMaxHealth,
        roomsEncountered: run.roomsEncountered,
        currentAct: run.currentAct,
        destinationIndexInAct: run.destinationIndexInAct,
        completedDestinations: run.completedDestinations,
        runTrinkets: run.runTrinkets,
        encounteredRunEnemyIds: run.encounteredRunEnemyIds,
        selectedDifficulty: run.selectedDifficulty,
        contentSystemType: run.contentSystemType,
        labyrinthMap: session.labyrinthMap,
        hasActiveBattle: battle.hasActiveBattle,
        battleState: battle.battleState,
        labyrinthPendingNode: session.activeLabyrinthPendingNode,
        activeLabyrinthModifiers: session.activeLabyrinthModifiers,
        activeLabyrinthRewardModifiers: session.activeLabyrinthRewardModifiers,
        runTalentXP: run.runTalentXP,
        currentScreen: screen,
        destinationChoices: session.rewardState.destinations,
      }),
    [screen, run, session, battle],
  );
}
