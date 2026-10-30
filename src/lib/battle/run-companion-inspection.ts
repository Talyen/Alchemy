import {
  getCompanionDescriptionLines,
  getModifiedCompanionEffects,
  mapEffectChildren,
  type BattleCardEffect,
  type CompanionDefinition,
  type DamageType,
} from "@/lib/game-data";
import type { BattleSnapshot } from "./types";
import { flatDamageBonus } from "./damage-modifiers";
import { effectivePlayerHealingAmount } from "./health-state";
import { playerStatusDelta } from "./status-state";
import { scaleGoldReward } from "./resource-state";

export type RunCompanionInspectionState = Pick<
  BattleSnapshot,
  "talentEffects" | "gearEffects" | "trinketEffects" | "playerHealth" | "playerMaxHealth"
>;

/** Standing actor bonuses only: no hypothetical enemy, temporary battle flags, mitigation or random roll. */
export function getRunCompanionDescriptionLines(
  companion: CompanionDefinition,
  state: RunCompanionInspectionState,
): string[] {
  const effects = getModifiedCompanionEffects(companion, state.talentEffects.companionBondLevels[companion.id] ?? 0, {
    damageBonus:
      state.talentEffects.companionDamage +
      state.gearEffects.companionDamageBonus +
      state.trinketEffects.companionDamageBonus,
    damageMultiplier: 1,
  });
  const flatBonus = (type: DamageType) =>
    flatDamageBonus(state, type) +
    (state.gearEffects.sharedBurnBleedBonuses > 0 && (type === "burn" || type === "bleed")
      ? flatDamageBonus(state, type === "burn" ? "bleed" : "burn")
      : 0);
  function inspect(effect: BattleCardEffect): BattleCardEffect {
    if (effect.kind === "damage") {
      const types = effect.damageTypePool?.length ? effect.damageTypePool : [effect.damageType];
      const amounts = types.map((type) => Math.max(0, effect.amount + flatBonus(type)));
      if (amounts.every((amount) => amount === amounts[0])) return { ...effect, amount: amounts[0]! };
      return {
        kind: "random-damage",
        minAmount: Math.min(...amounts),
        maxAmount: Math.max(...amounts),
        damageTypePool: [...types],
        ...(effect.lifesteal ? { lifesteal: true } : {}),
      };
    }
    if (effect.kind === "heal") return { ...effect, amount: effectivePlayerHealingAmount(state, effect.amount) };
    if (effect.kind === "gain-gold") return { ...effect, amount: scaleGoldReward(effect.amount, state.gearEffects) };
    if (effect.kind === "player-status")
      return { ...effect, amount: playerStatusDelta(state, effect.status, effect.amount) };
    return mapEffectChildren(effect, inspect);
  }
  // Bond and generic Companion bonuses are already applied. Format without applying them twice.
  return getCompanionDescriptionLines({ ...companion, turnStartEffects: effects.map(inspect) });
}
