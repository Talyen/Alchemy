// ============ Combat Constants ============
// All tuning values centralized here so balance changes don't require hunting
// through game-logic code. These are imported by battle/effects.ts and battle/turns.ts.

export const GLOBAL_CRIT_CHANCE = 5;
export const CRIT_MULTIPLIER = 2;
export const BLEED_STATUS_MULTIPLIER = 2; // Bleed stacks gain 2× damage dealt (burst DoT vs burn/poison sustain).
export const STUN_THRESHOLD_FRACTION = 0.5; // Stun when stacks reach this fraction of current enemy Health (uses >=, like freeze).
export const FREEZE_THRESHOLD_FRACTION = 0.5; // Freeze when stacks reach this fraction of current enemy Health.
export const WISH_CHOICE_COUNT = 3;
export const MIN_MAX_MANA_FLOOR = 1; // Prevents 0 maxMana softlock.

// ============ Battle / Rooms ============
export const ROOM_SCALING_INCREMENT = 0.07; // +7% enemy HP/attack per room (multiplicative).
export const ELITE_HP_MULTIPLIER = 1.3;
export const STARTING_TURN = 1;
export const ENEMY_BASE_REGENERATION = 1;
export const ENEMY_BOSS_REGENERATION = 1;
export const BLEED_EXECUTE_MULTIPLIER = 2;
export const FREE_CARD_SENTINEL = 99; // nextCardCostReduction value that guarantees a card costs 0.
export const PERCENT_DENOMINATOR = 100;
export const HALF_DIVISOR = 2;
const LEECH_HEAL_FRACTION = 0.5;

/** Leech keyword: heal for half the triggering damage (rounded). */
export function computeLeechHeal(damageDealt: number): number {
  if (damageDealt <= 0) return 0;
  return Math.round(damageDealt * LEECH_HEAL_FRACTION);
}
export const FIRST_EFFECT_MULTIPLIER = 2;
/** Wildfire talent: first burn card each combat deals 50% more (not a full double). */
export const FIRST_BURN_CARD_BONUS_MULTIPLIER = 1.5;
/** Flaming Shield / Impact Guard: bonus damage from block as a percent of current block. */
export const BLOCK_SCALED_DAMAGE_PERCENT = 30;
/** Manaburn talent: burn bonus from max mana as a percent of Mana Crystals. */
export const MANA_BURN_DAMAGE_PERCENT = 35;
export const GOLD_TROVE_REWARD_MULTIPLIER = 2;

// ============ Battle Tuning ============
export const CARDS_PER_TURN = 4; // Drawn each turn after hand is discarded; overflow draws are skipped (not discarded).
export const MAX_HAND_SIZE = 7;
export const MAX_PLAYER_HEALTH = 30;
export const MAX_HEALTH_PER_TALENT_POINT = 1;
export const BASE_ENEMY_HEALTH = 30;
export const BASE_PLAYER_MANA = 4;
export const DEFAULT_BATTLE_ENEMY_TYPE = "normal";

// ============ Timing (ms) ============
export const AUTO_END_TURN_DELAY = 1220;
export const AUTOPLAY_RETRY_DELAY_MS = 50;
export const SLICE_DEATH_DURATION_MS = 1250;
export const VICTORY_TRANSITION_DELAY = 1300;
export const ENEMY_PHASE_DELAY = 900;
export const ENEMY_ATTACK_RECOVERY_DELAY = 500;
export const SHAKE_DURATION = 420;
export const HURT_FLASH_DURATION_MS = 280;
export const HURT_SPARK_DURATION_MS = 450;
export const HURT_SPARK_COUNT = 32;
export const COMPANION_ATTACK_DELAY = 1000;
export const NAVIGATION_DELAY_MS = 100;
export const CAMPFIRE_ANIMATION_MS = 900;
export const CAMPFIRE_CONTINUE_DELAY = 400;

// ============ Campfire ============
export const CAMPFIRE_HEAL_FRACTION = 0.3; // Restores 30% of max Health — meaningful but not full recovery.

/** Effective campfire heal fraction including talent bonus. */
export function getCampfireHealFraction(campfireHealBonus = 0): number {
  return CAMPFIRE_HEAL_FRACTION + campfireHealBonus;
}

/** Restored Health after a campfire rest, clamped to max. */
export function getCampfireRestHealth(
  currentHealth: number,
  maxHealth: number,
  healFraction: number = CAMPFIRE_HEAL_FRACTION,
): number {
  return Math.min(maxHealth, currentHealth + Math.floor(maxHealth * healFraction));
}

// ============ Talents / XP ============
export const XP_BASE_PER_POINT = 10; // Point n costs n×10 XP (triangular total).
export const XP_TRIANGULAR_MULTIPLIER = 5; // Total XP for n points: n(n+1)/2 × 5.
export const XP_MIN_THRESHOLD = 10;
export const XP_ROOT_DIVISOR = 0.8; // Inverse formula: sqrt(1 + 0.8×XP).
export const TALENT_UNLOCK_ANIMATION_MS = 620;
export const TALENT_UNLOCK_SETTLE_MS = 400;
