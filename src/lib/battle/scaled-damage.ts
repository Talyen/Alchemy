import { mergeCombatText } from "./combat-text";
import { damageEnemyHealth, type BattleState, type CombatTextEvent } from "./types";
import { paceCombatMagnitude } from "./fight-pacing";

export interface DealEnemyScaledDamageOptions {
  multiplier?: number;
  riders?: (state: BattleState, finalDamage: number, combatTexts: CombatTextEvent[]) => BattleState;
}

export function dealEnemyScaledDamage(
  state: BattleState,
  baseDamage: number,
  stat: "physical" | "burn" | "nature",
  combatTexts: CombatTextEvent[],
  options: DealEnemyScaledDamageOptions = {},
): BattleState {
  if (baseDamage <= 0 || state.enemyHealth <= 0) return state;
  const pacedDamage = paceCombatMagnitude(state, baseDamage, "player");
  const finalDamage = Math.round(pacedDamage * (options.multiplier ?? 1));
  if (finalDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat, amount: finalDamage });
  }
  const hit = damageEnemyHealth(state, finalDamage);
  return options.riders ? options.riders(hit.state, finalDamage, combatTexts) : hit.state;
}
