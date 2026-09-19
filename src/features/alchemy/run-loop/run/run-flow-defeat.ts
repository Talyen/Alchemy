import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  applyRunDefeatTeardown,
  abandonRun,
  clearBattlePresentationUi,
} from "@/features/alchemy/shared/stores/run-lifecycle";
import { finalizeRunXP, setHasActiveBattle } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { BATTLE_END_TRANSITION_DELAY_MS } from "@/lib/game-constants";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { RunOutcomeDeps } from "./run-flow";
import { awardRunEndMaterials } from "./run-materials";

export function clearCombatState(draft: GameplayDraft) {
  setHasActiveBattle(draft, false);
}

function clearCombatPresentation() {
  clearBattlePresentationUi();
}

export function createDefeatHandlers(deps: RunOutcomeDeps) {
  function finalizeDefeat() {
    applyRunDefeatTeardown({
      awardRunEndMaterials,
      finalizeRunXP,
      clearCombatState,
      clearCombatPresentation,
    });
  }

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
    const ended = abandonRun({ awardRunEndMaterials, finalizeRunXP });
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
