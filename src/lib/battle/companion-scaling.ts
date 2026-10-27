import {
  getModifiedCompanionEffects,
  type BattleCard,
  type CompanionDamageModifiers,
  type CompanionDefinition,
} from "@/lib/game-data";
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

/** Build the same scaled Companion action for combat and its scoring projections. */
export function createCompanionActionCard(state: BattleSnapshot, companion: CompanionDefinition): BattleCard {
  return {
    id: `companion-${companion.id}`,
    title: companion.title,
    descriptionLines: [],
    art: companion.art,
    cost: 0,
    effects: getModifiedCompanionEffects(
      companion,
      state.talentEffects.companionBondLevels?.[companion.id] ?? 0,
      getBattleCompanionDamageModifiers(state),
    ),
  };
}
