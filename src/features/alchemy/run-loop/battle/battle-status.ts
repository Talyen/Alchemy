import type { BattleState, CombatTextEvent } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";
import { setBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

export function shouldPlayCardGoldGain(previousState: BattleState, nextState: BattleState, card: BattleCard) {
  return nextState.gold > previousState.gold && card.id !== "steal";
}

export function shouldShakeEnemyFromCombatTexts(combatTexts: CombatTextEvent[]) {
  return combatTexts.some((ct) => ct.kind === "damage" && ct.target === "enemy");
}

export function shouldShakePlayerFromCombatTexts(combatTexts: CombatTextEvent[]) {
  return combatTexts.some((ct) => ct.kind === "damage" && ct.target === "player");
}

export interface CombatTextShakeFeedback {
  shakeEnemy: () => void;
  shakePlayer: () => void;
}

export function applyCombatTextShakeFeedback(combatTexts: CombatTextEvent[], feedback: CombatTextShakeFeedback) {
  if (shouldShakeEnemyFromCombatTexts(combatTexts)) feedback.shakeEnemy();
  if (shouldShakePlayerFromCombatTexts(combatTexts)) feedback.shakePlayer();
}

export function isVictoryGraceActive(screen: Screen, enemyHealth: number, victoryDefeatHandled: boolean): boolean {
  return screen === "battle" && enemyHealth <= 0 && victoryDefeatHandled;
}

export function createBattleDevOutcomes(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
  function forceBattleOutcome(outcome: "victory" | "defeat", patch: (state: BattleState) => BattleState) {
    session.resetBattleSession();
    dispatchRunSessionCommand((draft) => setBattleState(draft, patch));
    session.handleVictoryDefeat(outcome);
  }

  function handleEndRun() {
    if (ctx.screen !== "battle") return;
    forceBattleOutcome("defeat", (c) => ({
      ...c,
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      deathsDoorGraceTurnsRemaining: null,
    }));
  }

  function skipCombatDevMode() {
    if (!import.meta.env.DEV || ctx.screen !== "battle") return;
    forceBattleOutcome("victory", (c) => ({ ...c, enemyHealth: 0, wishOptions: null, wishQueue: [] }));
  }

  return { handleEndRun, skipCombatDevMode };
}
