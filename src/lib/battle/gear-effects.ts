import type { GearEffectManifest } from "@/lib/gear";
import { PERCENT_DENOMINATOR } from "../game-constants";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { getEnemyDamageMultiplier } from "./status-effects";
import { applyPlayerHealing, type BattleState, type CombatTextEvent } from "./types";

export function gearResistancePercent(gear: GearEffectManifest, damageType?: string): number {
  switch (damageType) {
    case "physical":
      return gear.resistPhysical;
    case "stun":
      return gear.resistStun;
    case "holy":
      return gear.resistHoly;
    case "burn":
      return gear.resistBurn;
    case "poison":
      return gear.resistPoison;
    case "bleed":
      return gear.resistBleed;
    case "freeze":
      return gear.resistFreeze;
    case "nature":
      return gear.resistNature;
    default:
      return 0;
  }
}

export function applyGearDamageResistance(
  damage: number,
  damageType: string | undefined,
  gear: GearEffectManifest,
): number {
  const resist = gearResistancePercent(gear, damageType);
  if (resist <= 0) return damage;
  return Math.max(0, Math.round(damage * (1 - resist / PERCENT_DENOMINATOR)));
}

export function applyGearKillRewards(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.enemyHealth > 0 || !enemyWasAlive) return state;
  let nextState = state;
  const { healOnKill, goldOnKill } = state.gearEffects;
  if (healOnKill > 0) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, healOnKill);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healOnKill });
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  if (goldOnKill > 0) {
    const adjustedGold = scaleGoldReward(goldOnKill, nextState.gearEffects);
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: adjustedGold });
    nextState = { ...nextState, gold: nextState.gold + adjustedGold };
  }
  return nextState;
}

export function gearFrozenDamageMultiplier(state: BattleState): number {
  if (state.enemyFreezeSkipTurns <= 0 || state.gearEffects.frozenEnemyDamageBonusPercent <= 0) return 1;
  return 1 + state.gearEffects.frozenEnemyDamageBonusPercent / PERCENT_DENOMINATOR;
}

export function applyGearProcPhysicalDamage(state: BattleState, baseDamage: number, damageType = "physical"): number {
  const multiplier = getEnemyDamageMultiplier(state, damageType) * gearFrozenDamageMultiplier(state);
  return Math.round(baseDamage * multiplier);
}

export function scaledGearLeechHeal(baseHeal: number, gear: GearEffectManifest): number {
  if (gear.leechHealBonusPercent <= 0) return baseHeal;
  return Math.round(baseHeal * (1 + gear.leechHealBonusPercent / PERCENT_DENOMINATOR));
}

export function scaleGoldReward(baseGold: number, gear: GearEffectManifest): number {
  if (gear.goldGainPercent <= 0) return baseGold;
  return Math.round(baseGold * (1 + gear.goldGainPercent / PERCENT_DENOMINATOR));
}
