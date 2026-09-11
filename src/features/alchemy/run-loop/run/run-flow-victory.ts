import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { clearBattleUi, finalizeRunEndSession } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { finalizeRunXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { playGoldGain, playVictory, stopAllSfx } from "@/lib/audio";
import { BATTLE_END_TRANSITION_DELAY } from "@/lib/game-constants";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { RunOutcomeDeps } from "./run-flow";
import { awardRunEndMaterials } from "./run-flow-defeat";
import { createVictoryCommand } from "./victory-commands";

export function createVictoryHandlers(deps: RunOutcomeDeps) {
  const commit = createVictoryCommand(deps.getAvailableDestinations);
  function commitVictoryResult() {
    const goldGained = commit();
    if (goldGained === null) return false;
    if (goldGained) playGoldGain();
    deps.actions.clearCardHover();
    return true;
  }

  function handleBattleVictory() {
    if (!commitVictoryResult()) return;
    stopAllSfx();
    playVictory();
    if (readRunSession().hasActiveRun) {
      const nextScreen = ROUTE_SCREENS.REWARDS;
      deps.actions.transition(nextScreen, {
        delayMs: resolveGameDelay(BATTLE_END_TRANSITION_DELAY),
        guard: () => readRunSession().hasActiveRun,
      });
    }
  }

  function completeRunVictory(prepareNavigation?: () => void) {
    clearBattleUi();
    finalizeRunEndSession({
      awardRunEndMaterials,
      finalizeRunXP,
    });
    deps.actions.navigateTo(ROUTE_SCREENS.RUN_VICTORY, prepareNavigation);
  }

  return {
    commitVictoryResult,
    handleBattleVictory,
    completeRunVictory,
  };
}
