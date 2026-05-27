// Player end-turn animation gate before pure turn orchestration runs.
import type { RefObject } from "react";
import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { isAnimationDisabled } from "@/lib/game-constants";
import type { Screen } from "../types";
import { resolveEndTurnOrchestration, type TurnOrchestrationDeps } from "./turn-orchestration";

export type BattleEndTurnUiDeps = {
  screen: Screen;
  battleSessionRef: RefObject<number>;
  cardPlayInProgressRef: RefObject<boolean>;
  cardTransferInProgress: boolean;
  resolvedAsHasteOrStunRef: RefObject<boolean>;
  clearBattleTimeoutsKeepCompanion: () => void;
  runIfSessionActive: (session: number, action: () => void) => void;
  resetHandTransferUi: () => void;
  getTurnOrchestrationDeps: () => TurnOrchestrationDeps;
  animateDiscardedHand: (hand: BattleCard[], session: number) => Promise<void>;
  logBattleError: (context: string, err: unknown) => void;
  getStore: () => { battleState: BattleState };
};

export function createBattleEndTurnUi(deps: BattleEndTurnUiDeps) {
  function resolveEndTurn(currentState: BattleState, session: number) {
    resolveEndTurnOrchestration(deps.getTurnOrchestrationDeps(), currentState, session);
  }

  async function animateEndTurnThenResolve(currentState: BattleState, session: number) {
    try {
      if (!isAnimationDisabled()) {
        try {
          await deps.animateDiscardedHand(currentState.hand, session);
        } catch (err) {
          deps.logBattleError("discard hand animation", err);
        }
      }
      deps.runIfSessionActive(session, () => {
        resolveEndTurn(currentState, session);
      });
    } finally {
      deps.runIfSessionActive(session, () => {
        if (!deps.resolvedAsHasteOrStunRef.current) {
          deps.resetHandTransferUi();
        }
        deps.cardPlayInProgressRef.current = false;
      });
    }
  }

  function handleEndTurn() {
    const currentState = deps.getStore().battleState;
    if (
      deps.screen !== "battle" ||
      currentState.turnPhase !== "player" ||
      currentState.wishOptions ||
      deps.cardPlayInProgressRef.current ||
      deps.cardTransferInProgress
    )
      return;
    deps.clearBattleTimeoutsKeepCompanion();
    const session = deps.battleSessionRef.current;

    void animateEndTurnThenResolve(currentState, session).catch((err) =>
      deps.logBattleError("resolve end turn animation sequence", err),
    );
  }

  return { handleEndTurn, resolveEndTurn };
}
