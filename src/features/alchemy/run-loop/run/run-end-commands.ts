import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  abandonRun,
  applyRunDefeatTeardown,
  clearBattlePresentationUi,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/run-lifecycle";
import { finalizeRunXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { awardRunEndMaterials } from "./run-materials";

const settlement = { awardRunEndMaterials, finalizeRunXP };
export function completeRunVictory(gameSession: GameSession = defaultGameSession): void {
  finalizeRunEndSession(settlement, gameSession);
}
export function completeRunDefeat(gameSession: GameSession = defaultGameSession): void {
  applyRunDefeatTeardown(
    { ...settlement, clearCombatPresentation: () => clearBattlePresentationUi(gameSession) },
    gameSession,
  );
}
export function abandonCurrentRun(gameSession: GameSession = defaultGameSession): boolean {
  return abandonRun(settlement, gameSession);
}
