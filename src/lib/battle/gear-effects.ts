import type { GearEffectManifest } from "@/lib/gear";
import { PERCENT_DENOMINATOR } from "../game-constants";
import { mergeCombatText } from "./combat-text";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { applyLuckyCloverGold } from "./trinket-effects";
import { payKillPayouts } from "./kill-payouts";
import { clampHealth, type BattleState, type CombatTextEvent } from "./types";
import { paceCombatMagnitude } from "./fight-pacing";

export function gearFrozenDamageMultiplier(state: BattleState): number {
  if (state.enemyCC.freezeSkipTurns <= 0 || state.gearEffects.frozenEnemyDamageBonusPercent <= 0) return 1;
  return 1 + state.gearEffects.frozenEnemyDamageBonusPercent / PERCENT_DENOMINATOR;
}

export function scaledGearLeechHeal(baseHeal: number, gear: GearEffectManifest): number {
  if (gear.leechHealBonusPercent <= 0) return baseHeal;
  return Math.round(baseHeal * (1 + gear.leechHealBonusPercent / PERCENT_DENOMINATOR));
}

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
  if (baseDamage <= 0) return state;
  const pacedDamage = paceCombatMagnitude(state, baseDamage, "player");
  const finalDamage = Math.round(pacedDamage * (options.multiplier ?? 1));
  if (finalDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat, amount: finalDamage });
  }
  const nextState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
  };
  return options.riders ? options.riders(nextState, finalDamage, combatTexts) : nextState;
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
      const afterClover = options.grantLuckyClover ? applyLuckyCloverGold(nextState, finalDamage, texts) : nextState;
      return payKillPayouts(afterClover, enemyWasAlive, texts);
    },
  });
}
