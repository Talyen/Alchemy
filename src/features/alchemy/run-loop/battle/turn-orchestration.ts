import { current } from "immer";
import {
  battleSnapshot,
  isPlayerDefeated,
  processCompanionTurnStart,
  recoverLegacyEnemyPhase,
  resolveBattleTurn,
  type BattleSnapshot,
  type ResolvedBattleTurn,
} from "@/lib/battle";
import {
  awardBattleDodgeXP,
  commitBattleTransition,
  createDraftRunRandomSource,
  withDraftWorldBattleRng,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import type { createBattleSession } from "./battle-session";

export function commitEndTurn(): ResolvedBattleTurn {
  markBattleStage("resolve-start");
  try {
    return dispatchRunSessionCommand((draft) => {
      const before = current(draft.battle.battleState);
      const result = resolveBattleTurn(before, { rng: createDraftRunRandomSource(draft, "world") });
      awardBattleDodgeXP(draft, before, result.state);
      commitBattleTransition(draft, result.state, null);
      return result;
    });
  } finally {
    markBattleStage("resolve-end");
  }
}

/** Older saves can contain a precomputed result. Consume it once without repeating its rolls or XP. */
export function resumePendingBattleTransition(
  sessionNum: number,
  session: Pick<ReturnType<typeof createBattleSession>, "isCurrentBattleSession" | "checkBattleEnd">,
): BattleSnapshot | null {
  if (!session.isCurrentBattleSession(sessionNum) || !readBattle().pendingBattleTransition) return null;
  const state = dispatchRunSessionCommand((draft) => {
    const pending = draft.battle.pendingBattleTransition ? current(draft.battle.pendingBattleTransition) : null;
    if (!pending) return current(draft.battle.battleState);
    let state = "resultState" in pending ? pending.resultState : current(draft.battle.battleState);
    if (pending.kind === "legacy-enemy-turn") {
      state = battleSnapshot(recoverLegacyEnemyPhase(withDraftWorldBattleRng(draft, state)));
    } else if (pending.kind === "continue-end-turn" || ("playerTurnSkipped" in pending && pending.playerTurnSkipped)) {
      const result = resolveBattleTurn(state, { rng: createDraftRunRandomSource(draft, "world") });
      awardBattleDodgeXP(draft, state, result.state);
      state = result.state;
    } else if (pending.kind === "enemy-turn" && state.enemyHealth > 0 && !isPlayerDefeated(state)) {
      state = battleSnapshot(processCompanionTurnStart(withDraftWorldBattleRng(draft, state), []));
    }
    commitBattleTransition(draft, state, null);
    return state;
  });
  session.checkBattleEnd(state, sessionNum);
  return state;
}
