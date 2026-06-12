// Shared status math: halved decay, armor decay after damage, percent rolls.
// Depends on game-constants and battle types. Used by status-ticks and status-effects.
import { BATTLE_CONFIG, HALF_DIVISOR, PERCENT_DENOMINATOR, POISON_DECAY_PERCENT } from "../game-constants";
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

/** Poison stacks lost after tick: max(1, round(stacks * POISON_DECAY_PERCENT / 100)). */
export function decayPoisonStacks(stacks: number): number {
  if (stacks <= 0) return 0;
  const decay = Math.max(1, Math.round((stacks * POISON_DECAY_PERCENT) / PERCENT_DENOMINATOR));
  return Math.max(0, stacks - decay);
}

/** Halves freeze stack gain when the player talent is active. */
export function scaleFreezeBuildUp(amount: number, halfBuildUp: boolean): number {
  return halfBuildUp ? Math.round(amount / HALF_DIVISOR) : amount;
}

/** Rolls a 0–100 talent/trinket chance. Safe-guards against null rng. */
export function rollPercent(chance: number, rng: () => number) {
  return chance > 0 && rng() * PERCENT_DENOMINATOR < chance;
}

/** Extracts rng from battle state, falling back to Math.random if absent. */
export function getBattleRng(state: { rng?: () => number }): () => number {
  return state.rng ?? Math.random;
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
