import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { clearBattleTransition, commitBattleTransition } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { createBattleSession } from "./battle-session";
import type { BattlePresentationPort } from "./battle-presentation-store";
import type { HandDrawSequenceDeps } from "./draw-sequence";

export type BattleTurnSession = Pick<
  ReturnType<typeof createBattleSession>,
  "isCurrentBattleSession" | "runIfSessionActive" | "checkBattleEnd" | "handleVictoryDefeat"
>;

export interface TurnOrchestration {
  getDrawSequenceDeps: () => HandDrawSequenceDeps;
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

function finalizePlayerTurnResume(
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

export function commitDrawAndResume(
  state: BattleState,
  playerTurnSkipped: boolean,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
  commit: BattleState | "clear-when-idle" | null,
): void {
  if (commit !== null && commit !== "clear-when-idle") {
    const commitState = commit;
    const continuation = getBattleContinuation(state, playerTurnSkipped);
    dispatchRunSessionCommand((draft) => commitBattleTransition(draft, commitState, continuation));
  } else if (commit === "clear-when-idle" && !getBattleContinuation(state, playerTurnSkipped)) {
    dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
  }
  finalizePlayerTurnResume(
    readBattle().battleState,
    playerTurnSkipped,
    sessionNum,
    battleSession,
    orch,
    resolveEndTurn,
  );
}
