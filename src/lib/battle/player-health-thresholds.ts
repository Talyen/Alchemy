import { PERCENT_DENOMINATOR } from "../game-constants";
import { applyPlayerStatusEffect } from "./status-player";
import type { BattleState, CombatTextEvent } from "./types";

export function checkHealthThresholds(
  prevHealth: number,
  nextHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
) {
  let nextState = state;

  function applyHealthThresholdStatBonus(
    currentState: BattleState,
    configs: { threshold: number; amount: number } | Array<{ threshold: number; amount: number }> | null,
    stat: "block" | "armor",
  ): BattleState {
    const bonuses = configs == null ? [] : Array.isArray(configs) ? configs : [configs];
    let next = currentState;
    for (const config of bonuses) {
      const thresholdHp = (state.playerMaxHealth * config.threshold) / PERCENT_DENOMINATOR;
      if (prevHealth > thresholdHp && nextHealth <= thresholdHp) {
        next = applyPlayerStatusEffect(
          next,
          { kind: "player-status", status: stat, amount: config.amount },
          combatTexts,
        );
      }
    }
    return next;
  }

  nextState = applyHealthThresholdStatBonus(nextState, state.talentEffects.healthThresholdBlock, "block");
  nextState = applyHealthThresholdStatBonus(nextState, state.talentEffects.healthThresholdArmor, "armor");
  return nextState;
}
