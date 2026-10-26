import type { CompanionDamageModifiers } from "@/lib/game-data";
import { LOW_HEALTH_THRESHOLD_PERCENT, PERCENT_DENOMINATOR } from "../game-constants";
import type { BattleSnapshot } from "./types";

type CompanionScalingState = Pick<
  BattleSnapshot,
  "talentEffects" | "gearEffects" | "trinketEffects" | "enemyCC" | "enemyStatuses" | "enemyHealth" | "enemyMaxHealth"
>;

/** Companion-specific scaling, before ordinary hit modifiers and target defenses. */
export function getBattleCompanionDamageModifiers(state: CompanionScalingState): CompanionDamageModifiers {
  const talents = state.talentEffects;
  return {
    damageBonus:
      talents.companionDamage +
      state.gearEffects.companionDamageBonus +
      (state.enemyStatuses.bleed > 0 ? state.gearEffects.companionDamageBonusVsBleeding : 0) +
      state.trinketEffects.companionDamageBonus +
      (state.enemyCC.freezeSkipTurns > 0 ? talents.companionVsFrozenBonus : 0),
    damageMultiplier:
      talents.companionDoubledVsLowHealth &&
      state.enemyHealth < (state.enemyMaxHealth * LOW_HEALTH_THRESHOLD_PERCENT) / PERCENT_DENOMINATOR
        ? 2
        : 1,
  };
}
