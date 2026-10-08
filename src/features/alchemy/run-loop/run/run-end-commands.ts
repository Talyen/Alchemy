import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  abandonRun,
  applyRunDefeatTeardown,
  clearBattlePresentationUi,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/run-lifecycle";
import { finalizeRunXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { awardRunEndMaterials } from "@/features/alchemy/shared/stores/run-session-write-port";

const settlement = { awardRunEndMaterials, finalizeRunXP };
export function completeRunVictory(gameSession: GameSession): void {
  finalizeRunEndSession(settlement, gameSession);
}
export function completeRunDefeat(gameSession: GameSession): void {
  applyRunDefeatTeardown(
    { ...settlement, clearCombatPresentation: () => clearBattlePresentationUi(gameSession) },
    gameSession,
  );
}
export function abandonCurrentRun(gameSession: GameSession): boolean {
  return abandonRun(settlement, gameSession);
}
