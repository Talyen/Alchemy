import type { CompanionDamageModifiers } from "@/lib/game-data";
import { LOW_HEALTH_THRESHOLD_PERCENT, PERCENT_DENOMINATOR } from "../game-constants";
import { scalePerMana } from "./amount-helpers";
import type { BattleSnapshot } from "./types";

type CompanionScalingState = Pick<
  BattleSnapshot,
  | "talentEffects"
  | "gearEffects"
  | "trinketEffects"
  | "companionDamageBuff"
  | "enemyCC"
  | "maxMana"
  | "enemyHealth"
  | "enemyMaxHealth"
>;

/** Companion-specific scaling, before ordinary hit modifiers and target defenses. */
export function getBattleCompanionDamageModifiers(state: CompanionScalingState): CompanionDamageModifiers {
  const talents = state.talentEffects;
  return {
    damageBonus:
      talents.companionDamage +
      state.gearEffects.companionDamageBonus +
      state.trinketEffects.companionDamageBonus +
      state.companionDamageBuff +
      (state.enemyCC.freezeSkipTurns > 0 ? talents.companionVsFrozenBonus : 0) +
      scalePerMana(state.maxMana, talents.companionDamagePerManaCrystal, "half"),
    bleedDamageBonus: talents.companionBleedDamageBonus,
    damageMultiplier:
      talents.companionDoubledVsLowHealth &&
      state.enemyHealth < (state.enemyMaxHealth * LOW_HEALTH_THRESHOLD_PERCENT) / PERCENT_DENOMINATOR
        ? 2
        : 1,
  };
}
