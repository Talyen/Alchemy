import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { clearBattleTransition } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { createBattleSession } from "./battle-session";
import type { HandDrawSequenceDeps } from "./draw-sequence";
import type { BattlePresentationPort } from "./battle-presentation-port";

export type BattleTurnSession = Pick<
  ReturnType<typeof createBattleSession>,
  "isCurrentBattleSession" | "runIfSessionActive" | "checkBattleEnd" | "handleVictoryDefeat"
>;

export interface TurnOrchestration {
  getDrawSequenceDeps: () => HandDrawSequenceDeps;
  logBattleError: (context: string, err: unknown) => void;
  resetHandTransferUi: () => void;
  scheduleCompanionFollowUp: (resultState: BattleState, sessionNum: number) => void;
  scheduleAutoEndTurn: (resultState: BattleState) => void;
  getPresentation: () => BattlePresentationPort;
}

export type ResolveEndTurn = (
  currentState: BattleState,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
) => boolean;

export function getBattleContinuation(
  state: BattleState,
  playerTurnSkipped: boolean,
): PersistedBattleTransition | null {
  if (!playerTurnSkipped || state.enemyHealth <= 0 || isPlayerDefeated(state)) return null;
  return { kind: "continue-end-turn" };
}

export function finalizePlayerTurnResume(
  state: BattleState,
  playerTurnSkipped: boolean,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
): void {
  if (battleSession.checkBattleEnd(state, sessionNum)) return;
  if (playerTurnSkipped) {
    dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
    resolveEndTurn(state, sessionNum, battleSession, orch);
    return;
  }
  orch.scheduleCompanionFollowUp(state, sessionNum);
  orch.scheduleAutoEndTurn(state);
}
