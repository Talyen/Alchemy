// Shared status math: halved decay, armor decay after damage, percent rolls, damage multipliers.
// Depends on game-constants and battle types. Used by status-ticks, status-player,
// damage-status-riders, and the damage calc.
import {
  BATTLE_CONFIG,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
  POISON_DECAY_PERCENT,
  TRAIT_DAMAGE_RULES,
  TRAIT_DAMAGE_WEAKNESS,
} from "../game-constants";
import { mergeCombatText } from "./combat-text";
import { addPlayerStatus, type BattleState, type CombatTextEvent } from "./types";
import { paceCombatMagnitude } from "./fight-pacing";

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

/** Burn damage bonus vs bleeding enemies — shared by card damage calc and burn ticks. */
export function getBurnBonusToBleedingMultiplier(state: Pick<BattleState, "enemyStatuses" | "gearEffects">): number {
  if (state.enemyStatuses.bleed <= 0 || state.gearEffects.burnDamageBonusToBleedingPercent <= 0) return 1;
  return 1 + state.gearEffects.burnDamageBonusToBleedingPercent / PERCENT_DENOMINATOR;
}

/** Trait weakness/resistance — first matching trait wins, then CC bonuses. */
export function getEnemyDamageMultiplier(
  state: Pick<BattleState, "currentEnemy" | "enemyCC" | "talentEffects">,
  damageType: string,
): number {
  const traitIds = state.currentEnemy.traits.map((t) => t.id);
  for (const rule of TRAIT_DAMAGE_RULES) {
    if (traitIds.includes(rule.traitId) && damageType === rule.damageType) return rule.multiplier;
  }
  let multiplier = 1;
  if (state.enemyCC.stunSkipTurns > 0 && state.talentEffects.stunDoubleDamage) multiplier *= TRAIT_DAMAGE_WEAKNESS;
  if (state.enemyCC.freezeSkipTurns > 0 && state.talentEffects.freezeDoubleDamage) multiplier *= TRAIT_DAMAGE_WEAKNESS;
  return multiplier;
}

/** Rolls a 0–100 talent/boon chance. Safe-guards against null rng. */
export function rollPercent(chance: number, rng: () => number) {
  return chance > 0 && rng() * PERCENT_DENOMINATOR < chance;
}

/** Extracts rng from battle state. Missing rng is a programming error. */
export function getBattleRng(state: { rng?: () => number }): () => number {
  if (!state.rng) {
    throw new Error("BattleState.rng is required for outcome rolls");
  }
  return state.rng;
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
    const beforeBlock = nextState.playerStatuses.block;
    nextState = addPlayerStatus(
      nextState,
      "block",
      paceCombatMagnitude(nextState, nextState.talentEffects.armorBreakBlock, "player"),
    );
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: CONSTANTS.COMBAT_TEXT.TARGET_PLAYER,
        kind: CONSTANTS.COMBAT_TEXT.KIND_STATUS,
        stat: CONSTANTS.COMBAT_TEXT.STAT_BLOCK,
        amount: nextState.playerStatuses.block - beforeBlock,
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
