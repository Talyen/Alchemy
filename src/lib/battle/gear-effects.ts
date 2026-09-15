import type { GearEffectManifest } from "@/lib/gear";
import { PERCENT_DENOMINATOR } from "../game-constants";
import { applyPercentBonus } from "./amount-helpers";
import { applyHitEpilogue } from "./combat-text";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { type BattleState, type CombatTextEvent } from "./types";
import { dealEnemyScaledDamage } from "./scaled-damage";

export function gearFrozenDamageMultiplier(state: BattleState): number {
  if (state.enemyCC.freezeSkipTurns <= 0 || state.gearEffects.frozenEnemyDamageBonusPercent <= 0) return 1;
  return 1 + state.gearEffects.frozenEnemyDamageBonusPercent / PERCENT_DENOMINATOR;
}

export function scaledGearLeechHeal(baseHeal: number, gear: GearEffectManifest): number {
  return applyPercentBonus(baseHeal, gear.leechHealBonusPercent, PERCENT_DENOMINATOR);
}

export function applyGearCcPhysicalDamage(
  state: BattleState,
  gearDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (gearDamage <= 0) return state;
  const enemyWasAlive = state.enemyHealth > 0;
  return dealEnemyScaledDamage(state, gearDamage, "physical", combatTexts, {
    multiplier: getEnemyDamageMultiplier(state, "physical") * gearFrozenDamageMultiplier(state),
    riders: (nextState, _finalDamage, texts) => applyHitEpilogue(nextState, state.enemyHealth, enemyWasAlive, texts),
  });
}
