import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { BATTLE_END_TRANSITION_DELAY_MS } from "@/lib/game-constants";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { RunOutcomeDeps } from "./run-flow";
import { completeRunDefeat, abandonCurrentRun } from "./run-end-commands";
export { clearCombatState } from "./run-end-commands";

export function createDefeatHandlers(deps: RunOutcomeDeps) {
  const finalizeDefeat = completeRunDefeat;

  function endRunAndShowGameOver() {
    finalizeDefeat();
    deps.actions.transition(ROUTE_SCREENS.GAME_OVER, { immediate: true });
  }

  function handleBattleDefeat() {
    deps.actions.transition(ROUTE_SCREENS.GAME_OVER, {
      delayMs: resolveGameDelay(BATTLE_END_TRANSITION_DELAY_MS),
      guard: () => readRunSession().hasActiveRun,
      prepare: finalizeDefeat,
    });
  }

  function isLabyrinthRun() {
    return readActiveRun().contentSystemType === CONTENT_SYSTEMS.LABYRINTH;
  }

  function endLabyrinthRun() {
    if (!isLabyrinthRun()) return;
    endRunAndShowGameOver();
  }

  function handleAbandonRun() {
    const ended = abandonCurrentRun();
    if (!ended) return;
    deps.actions.transition(ROUTE_SCREENS.GAME_OVER, { immediate: true });
  }

  return {
    endRunAndShowGameOver,
    handleBattleDefeat,
    handleAbandonRun,
    endLabyrinthRun,
  };
}
