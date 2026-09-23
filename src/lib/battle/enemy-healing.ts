import { clampHealth, type BattleState, type CombatTextEvent } from "./types";
import { halveRounded } from "./amount-helpers";
import { paceCombatMagnitude } from "./fight-pacing";
import { mergeCombatText } from "./combat-text-events";

export function applyEnemyHealingWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  if (amount <= 0 || state.enemyHealth <= 0) return state;
  if (state.enemyStatuses.poison > 0 && state.talentEffects.poisonHalvesHealing) amount = halveRounded(amount);
  if (state.enemyStatuses.bleed > 0 && state.talentEffects.bleedHalvesEnemyHealing) amount = halveRounded(amount);
  const healAmount = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "enemy");
  const nextHealth = clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth);
  const actualHeal = nextHealth - state.enemyHealth;
  if (actualHeal <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: actualHeal });
  return { ...state, enemyHealth: nextHealth };
}
