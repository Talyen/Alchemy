import type { GearEffectManifest } from "@/lib/gear";
import { PERCENT_DENOMINATOR } from "../game-constants";
import { payKillPayouts } from "./combat-text";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { applyLuckyCloverGold } from "./bonus-effects";
import { type BattleState, type CombatTextEvent } from "./types";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";
import { dealEnemyScaledDamage } from "./scaled-damage";

export { dealEnemyScaledDamage } from "./scaled-damage";

export function gearFrozenDamageMultiplier(state: BattleState): number {
  if (state.enemyCC.freezeSkipTurns <= 0 || state.gearEffects.frozenEnemyDamageBonusPercent <= 0) return 1;
  return 1 + state.gearEffects.frozenEnemyDamageBonusPercent / PERCENT_DENOMINATOR;
}

export function scaledGearLeechHeal(baseHeal: number, gear: GearEffectManifest): number {
  if (gear.leechHealBonusPercent <= 0) return baseHeal;
  return Math.round(baseHeal * (1 + gear.leechHealBonusPercent / PERCENT_DENOMINATOR));
}

export function applyGearCcPhysicalDamage(
  state: BattleState,
  gearDamage: number,
  combatTexts: CombatTextEvent[],
  options: { grantLuckyClover?: boolean } = {},
): BattleState {
  if (gearDamage <= 0) return state;
  const enemyWasAlive = state.enemyHealth > 0;
  return dealEnemyScaledDamage(state, gearDamage, "physical", combatTexts, {
    multiplier: getEnemyDamageMultiplier(state, "physical") * gearFrozenDamageMultiplier(state),
    riders: (nextState, finalDamage, texts) => {
      const afterThreshold = processEncounterTraitHealthThreshold(state.enemyHealth, nextState, texts);
      const afterClover = options.grantLuckyClover
        ? applyLuckyCloverGold(afterThreshold, finalDamage, texts)
        : afterThreshold;
      return payKillPayouts(afterClover, enemyWasAlive, texts);
    },
  });
}
