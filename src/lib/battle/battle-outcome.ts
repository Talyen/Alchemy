import type { BattleSnapshot } from "./types/state-types";

export type BattleOutcome = "victory" | "defeat";
type BattleSurvival = Pick<BattleSnapshot, "playerHealth" | "deathsDoorActive">;
type BattleOutcomeState = BattleSurvival & Pick<BattleSnapshot, "enemyHealth">;

export function isPlayerDefeated(state: BattleSurvival): boolean {
  return state.playerHealth <= 0 && !state.deathsDoorActive;
}

/** Defeat takes precedence when both combatants fall; Death's Door counts as survival. */
export function getBattleOutcome(state: BattleOutcomeState): BattleOutcome | null {
  if (isPlayerDefeated(state)) return "defeat";
  return state.enemyHealth <= 0 ? "victory" : null;
}
