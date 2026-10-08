import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { BATTLE_END_TRANSITION_DELAY_MS } from "@/lib/game-constants";
import { ROUTE_SCREENS } from "@/lib/routing";
import { completeRunVictory as commitRunVictory } from "./run-end-commands";
import type { RunOutcomeDeps } from "./run-flow";
import { createVictoryCommand } from "./victory-commands";

export function createVictoryHandlers(deps: RunOutcomeDeps, gameSession: GameSession) {
  const commit = createVictoryCommand(deps.getAvailableDestinations, gameSession);
  function commitVictoryResult() {
    const goldGained = commit();
    if (goldGained === null) return false;
    if (goldGained) sessionFeedback(gameSession).playGoldGain();
    deps.actions.clearCardHover();
    return true;
  }

  function handleBattleVictory() {
    if (!commitVictoryResult()) return;
    sessionFeedback(gameSession).stopAllSfx();
    sessionFeedback(gameSession).playVictory();
    if (readRunSession(gameSession).hasActiveRun) {
      const nextScreen = ROUTE_SCREENS.REWARDS;
      deps.actions.transition(nextScreen, {
        delayMs: resolveGameDelay(BATTLE_END_TRANSITION_DELAY_MS),
        guard: () => readRunSession(gameSession).hasActiveRun,
      });
    }
  }

  function completeRunVictory(prepareNavigation?: () => void) {
    clearBattlePresentationUi(gameSession);
    if (readRunSession(gameSession).hasActiveRun) commitRunVictory(gameSession);
    sessionFeedback(gameSession).playRunVictory();
    deps.actions.navigateTo(ROUTE_SCREENS.RUN_VICTORY, prepareNavigation);
  }

  return bindSessionCapabilities(gameSession, {
    commitVictoryResult,
    handleBattleVictory,
    completeRunVictory,
  });
}
