import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  abandonRun,
  applyRunDefeatTeardown,
  clearBattlePresentationUi,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/run-lifecycle";
import type { RunTransaction } from "@/features/alchemy/shared/stores/run-session-command";
import { finalizeRunXP, setHasActiveBattle } from "@/features/alchemy/shared/stores/run-session-write-port";
import { awardRunEndMaterials } from "./run-materials";

const settlement = { awardRunEndMaterials, finalizeRunXP };
export function clearCombatState(draft: RunTransaction): void {
  setHasActiveBattle(draft, false);
}
export function completeRunVictory(gameSession: GameSession = defaultGameSession): void {
  finalizeRunEndSession(settlement, gameSession);
}
export function completeRunDefeat(gameSession: GameSession = defaultGameSession): void {
  applyRunDefeatTeardown(
    { ...settlement, clearCombatState, clearCombatPresentation: () => clearBattlePresentationUi(gameSession) },
    gameSession,
  );
}
export function abandonCurrentRun(gameSession: GameSession = defaultGameSession): boolean {
  return abandonRun(settlement, gameSession);
}
