import type { GearEffectManifest } from "@/lib/gear";
import { PERCENT_DENOMINATOR } from "../game-constants";
import { applyPercentBonus } from "./amount-helpers";
import { applyHitEpilogue, applyIronGuardReward } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import type { BattleState, CombatTextEvent } from "./types";
import { addEnemyStatus } from "./status-state";
import { damageEnemyHealth } from "./health-state";
import { decayArmorAfterDamage, getEnemyDamageMultiplier } from "./status-helpers";
import { paceCombatDamage } from "./fight-pacing";
import { applyElementalDamageManaRestore } from "./player-hit-core";

export function gearFrozenDamageMultiplier(state: Pick<BattleState, "enemyCC" | "gearEffects">): number {
  if (state.enemyCC.freezeSkipTurns <= 0 || state.gearEffects.frozenEnemyDamageBonusPercent <= 0) return 1;
  return 1 + state.gearEffects.frozenEnemyDamageBonusPercent / PERCENT_DENOMINATOR;
}

export function scaledGearLeechHeal(baseHeal: number, gear: GearEffectManifest): number {
  return applyPercentBonus(baseHeal, gear.leechHealBonusPercent, PERCENT_DENOMINATOR);
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
  if (baseDamage <= 0 || state.enemyHealth <= 0) return state;
  const pacedDamage = paceCombatDamage(state, baseDamage, "player");
  const damage = Math.max(0, Math.round(pacedDamage * (options.multiplier ?? 1)));
  const absorbed = Math.min(damage, state.enemyMitigation.block);
  if (absorbed > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "block", amount: absorbed });
  }
  const blocked =
    absorbed > 0
      ? { ...state, enemyMitigation: { ...state.enemyMitigation, block: state.enemyMitigation.block - absorbed } }
      : state;
  const armor = stat === "physical" ? blocked.enemyMitigation.armor : 0;
  const finalDamage = Math.max(0, damage - absorbed - armor);
  if (finalDamage <= 0) return blocked;
  if (finalDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat, amount: finalDamage });
  }
  const hit = damageEnemyHealth(blocked, finalDamage);
  const rewarded = decayArmorAfterDamage(
    applyIronGuardReward(hit.state, stat, hit.healthDamage, combatTexts),
    finalDamage,
    "enemy",
    combatTexts,
  );
  const resolved = options.riders ? options.riders(rewarded, finalDamage, combatTexts) : rewarded;
  return applyElementalDamageManaRestore(resolved, stat, hit.healthDamage, combatTexts);
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
