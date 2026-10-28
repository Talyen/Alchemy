import type { BattleState, CombatTextEvent } from "./types";
import { clampHealth } from "./health-state";
import { halveRounded } from "./amount-helpers";
import { paceCombatMagnitude } from "./fight-pacing";
import { emitHealText } from "./combat-text-events";
import { hasEnemyTrait } from "./encounter-trait-state";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { getBattleOutcome } from "./battle-outcome";

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
  emitHealText(combatTexts, "enemy", "health", actualHeal);
  return { ...state, enemyHealth: nextHealth };
}

export function processContagion(
  state: BattleState,
  damageType: string,
  damageAmount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (damageType !== "poison" || damageAmount <= 0 || !hasEnemyTrait(state, "contagion")) return state;
  if (getBattleOutcome(state) !== null) return state;
  const healed = applyEnemyHealingWithCombatText(state, 1, combatTexts, { skipFightPacing: true });
  return healed.enemyHealth > state.enemyHealth ? recordEnemyAbilityActivation(healed, "contagion") : healed;
}
