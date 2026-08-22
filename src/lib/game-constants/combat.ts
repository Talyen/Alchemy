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
export const FREE_CARD_SENTINEL = 99; // nextCardCostReduction value that guarantees a card costs 0.
/** Shared "enemy below 30% health" threshold used by companion and archery low-health doubling. */
export const LOW_HEALTH_THRESHOLD_PERCENT = 30;
export const ARCHERY_HIGH_HEALTH_THRESHOLD_PERCENT = 75;
export const PERCENT_DENOMINATOR = 100;
export const HALF_DIVISOR = 2;
const LEECH_HEAL_FRACTION = 0.5;

/** Leech keyword: heal for half the triggering damage (rounded). */
export function computeLeechHeal(damageDealt: number): number {
  if (damageDealt <= 0) return 0;
  return Math.round(damageDealt * LEECH_HEAL_FRACTION);
}
export const FIRST_EFFECT_MULTIPLIER = 2;
/** Manaburn: burn bonus as a percent of Mana Crystals. Combat stores this percent on the talent manifest. */
export const MANABURN_DAMAGE_PERCENT = 35;
/**
 * Pre-percent Manaburn battle snapshots stored `1` (= talent enabled).
 * Hydrate rewrites only this sentinel onto MANABURN_DAMAGE_PERCENT.
 */
export const LEGACY_MANABURN_PER_CRYSTAL_ENABLED = 1;
/** Impact Guard / similar: bonus stun (or shared) damage from block as a percent of current block. */
export const BLOCK_SCALED_DAMAGE_PERCENT = 30;
/** Flaming Shield: Burn bonus from block. Lower than stun/physical so late Burn builds cannot one-tick bosses. */
export const BURN_BLOCK_SCALED_DAMAGE_PERCENT = 10;
export const GOLD_TROVE_REWARD_MULTIPLIER = 2;

// ============ Battle Tuning ============
export const CARDS_PER_TURN = 4; // Drawn each turn after hand is discarded; overflow draws are skipped (not discarded).
/** Death's Door recovery player turns after the first lethal save. Talent extension adds on top. */
export const DEATHS_DOOR_GRACE_TURNS = 2;
export const MAX_HAND_SIZE = 7;
export const MAX_PLAYER_HEALTH = 30;
export const MAX_HEALTH_PER_TALENT_POINT = 1;
export const BASE_ENEMY_HEALTH = 30;
export const BASE_PLAYER_MANA = 4;
export const DEFAULT_BATTLE_ENEMY_TYPE = "normal";

/** Hidden fight pacing: comeback (behind side) × clock (both sides). Live battles default on. */
export const FIGHT_PACING = {
  evenThreshold: 0.1,
  maxDelta: 0.5,
  comebackMin: 0.1,
  comebackMax: 0.2,
  scheduleThreshold: 0.03,
  gapFullScale: 0.1,
  clockMin: 0.1,
  clockMax: 0.2,
  burnFractionAtTarget: 0.5,
  backstopSpan: 4,
  clockByEnemyType: {
    normal: { targetDuration: 3.75, maxRounds: 5 },
    elite: { targetDuration: 5.25, maxRounds: 7 },
    boss: { targetDuration: 7.5, maxRounds: 10 },
  },
} as const;

// ============ Timing (ms) ============
export const AUTO_END_TURN_DELAY = 1220;
export const AUTOPLAY_RETRY_DELAY_MS = 50;
export const AUTOPLAY_POST_PLAY_DELAY_MS = 1000;
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
export const TALENT_UNLOCK_ANIMATION_MS = 300;
export const TALENT_UNLOCK_SPARK_COUNT = 16;
