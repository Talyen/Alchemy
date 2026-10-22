import type { GearEffectManifest } from "@/lib/gear";
import { PERCENT_DENOMINATOR } from "../game-constants";
import { applyPercentBonus } from "./amount-helpers";
import { applyHitEpilogue, applyIronGuardReward } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import type { BattleState, CombatTextEvent } from "./types";
import { damageEnemyHealth } from "./health-state";
import { decayArmorAfterDamage, getEnemyDamageMultiplier, getEnemyDamageVulnerabilityBonus } from "./status-helpers";
import { applySunderingArmorRemoval } from "./enemy-mitigation-state";
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

/** Shared pacing, vulnerability, Block spending and Armor mitigation before hit reactions. */
function prepareScaledEnemyHit(
  state: BattleState,
  baseDamage: number,
  stat: "physical" | "burn" | "nature",
  combatTexts: CombatTextEvent[],
  multiplier = 1,
) {
  if (baseDamage <= 0 || state.enemyHealth <= 0) return { state, damage: 0 };
  const pacedDamage = paceCombatDamage(state, baseDamage + getEnemyDamageVulnerabilityBonus(state), "player");
  const damage = Math.max(0, Math.round(pacedDamage * multiplier));
  const absorbed = Math.min(damage, state.enemyMitigation.block);
  if (absorbed > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "block", amount: absorbed });
  }
  const blocked =
    absorbed > 0
      ? { ...state, enemyMitigation: { ...state.enemyMitigation, block: state.enemyMitigation.block - absorbed } }
      : state;
  const sundered = applySunderingArmorRemoval(blocked, stat);
  const armor = stat === "physical" ? sundered.enemyMitigation.armor : 0;
  const finalDamage = Math.max(0, damage - absorbed - armor);
  return { state: sundered, damage: finalDamage };
}

export function dealEnemyScaledDamage(
  state: BattleState,
  baseDamage: number,
  stat: "physical" | "burn" | "nature",
  combatTexts: CombatTextEvent[],
  options: DealEnemyScaledDamageOptions = {},
): BattleState {
  const { state: sundered, damage: finalDamage } = prepareScaledEnemyHit(
    state,
    baseDamage,
    stat,
    combatTexts,
    options.multiplier,
  );
  if (finalDamage <= 0) return sundered;
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat, amount: finalDamage });
  const hit = damageEnemyHealth(sundered, finalDamage);
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
    riders: (nextState, _finalDamage, texts) =>
      applyHitEpilogue(nextState, state.enemyHealth, enemyWasAlive, texts, undefined, state.playerStatuses.forge >= 5),
  });
}
