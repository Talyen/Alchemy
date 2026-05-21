// Shared status math: halved decay, armor decay after damage, percent rolls.
// Depends on game-constants and battle types. Used by status-ticks and status-effects.
import { BATTLE_CONFIG, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";
import { mergeCombatText } from "./combat-text";
import type { BattleState, CombatTextEvent } from "./types";

/** Halves a stack each tick; stacks of 1 or less clear entirely. */
export function decayHalvedStatus(value: number) {
  if (value <= 1) return 0;
  return Math.round(value / HALF_DIVISOR);
}

/** Rolls a 0–100 talent/trinket chance against Math.random. */
export function rollPercent(chance: number) {
  return chance > 0 && Math.random() * PERCENT_DENOMINATOR < chance;
}

export type ArmorDecayTarget = "player" | "enemy";

/** Reduces armor by BATTLE_CONFIG.ARMOR_DECAY_AMOUNT when health damage was taken. */
export function decayArmorAfterDamage(
  state: BattleState,
  damage: number,
  target: ArmorDecayTarget,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (damage <= 0) return state;
  if (target === "enemy") {
    if (state.enemyMitigation.armor <= 0) return state;
    return {
      ...state,
      enemyMitigation: {
        ...state.enemyMitigation,
        armor: state.enemyMitigation.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT,
      },
    };
  }
  if (state.playerStatuses.armor <= 0) return state;
  const armorBefore = state.playerStatuses.armor;
  let nextState: BattleState = {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      armor: state.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT,
    },
  };
  if (armorBefore > 0 && nextState.playerStatuses.armor === 0 && nextState.talentEffects.armorBreakBlock > 0) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        block: nextState.playerStatuses.block + nextState.talentEffects.armorBreakBlock,
      },
    };
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "block",
        amount: nextState.talentEffects.armorBreakBlock,
      });
    }
  }
  return nextState;
}
