// Shared status math: halved decay, armor decay after damage, percent rolls.
// Depends on game-constants and battle types. Used by status-ticks and status-effects.
import { BATTLE_CONFIG, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";
import { mergeCombatText } from "./combat-text";
import type { BattleState, CombatTextEvent } from "./types";

const CONSTANTS = {
  DECAY_THRESHOLD: 1,
  MIN_ARMOR: 0,
  TARGETS: {
    PLAYER: "player",
    ENEMY: "enemy",
  },
  COMBAT_TEXT: {
    TARGET_PLAYER: "player",
    KIND_STATUS: "status",
    STAT_BLOCK: "block",
  },
} as const;

/** Halves a stack each tick; stacks of 1 or less clear entirely. */
export function decayHalvedStatus(value: number) {
  if (value <= CONSTANTS.DECAY_THRESHOLD) return 0;
  return Math.round(value / HALF_DIVISOR);
}

/** Rolls a 0–100 talent/trinket chance. */
export function rollPercent(chance: number, rng: () => number) {
  return chance > 0 && rng() * PERCENT_DENOMINATOR < chance;
}

export type ArmorDecayTarget = "player" | "enemy";

/**
 * Decays the enemy's armor when health damage is taken.
 * Enemy armor is stored in enemyMitigation.
 */
function decayEnemyArmor(state: BattleState): BattleState {
  if (state.enemyMitigation.armor <= CONSTANTS.MIN_ARMOR) {
    return state;
  }
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      armor: Math.max(0, state.enemyMitigation.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT),
    },
  };
}

/**
 * Decays the player's armor when health damage is taken.
 * Player armor is stored in playerStatuses. If armor breaks,
 * checks and applies the player's armorBreakBlock talent.
 */
function decayPlayerArmor(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  if (state.playerStatuses.armor <= CONSTANTS.MIN_ARMOR) {
    return state;
  }

  const armorBefore = state.playerStatuses.armor;
  let nextState: BattleState = {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      armor: Math.max(0, state.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT),
    },
  };

  // If player armor breaks and the armorBreakBlock talent is active, grant block.
  const armorBroke = armorBefore > CONSTANTS.MIN_ARMOR && nextState.playerStatuses.armor === CONSTANTS.MIN_ARMOR;
  const hasArmorBreakTalent = nextState.talentEffects.armorBreakBlock > 0;

  if (armorBroke && hasArmorBreakTalent) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        block: nextState.playerStatuses.block + nextState.talentEffects.armorBreakBlock,
      },
    };
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: CONSTANTS.COMBAT_TEXT.TARGET_PLAYER,
        kind: CONSTANTS.COMBAT_TEXT.KIND_STATUS,
        stat: CONSTANTS.COMBAT_TEXT.STAT_BLOCK,
        amount: nextState.talentEffects.armorBreakBlock,
      });
    }
  }

  return nextState;
}

/** Reduces armor by BATTLE_CONFIG.ARMOR_DECAY_AMOUNT when health damage was taken. */
export function decayArmorAfterDamage(
  state: BattleState,
  damage: number,
  target: ArmorDecayTarget,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (damage <= 0) return state;

  if (target === CONSTANTS.TARGETS.ENEMY) {
    return decayEnemyArmor(state);
  }
  return decayPlayerArmor(state, combatTexts);
}
