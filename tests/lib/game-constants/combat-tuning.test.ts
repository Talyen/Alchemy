import { describe, expect, it } from "vitest";
import {
  GLOBAL_CRIT_CHANCE,
  CRIT_MULTIPLIER,
  BLEED_STATUS_MULTIPLIER,
  STUN_THRESHOLD_FRACTION,
  FREEZE_THRESHOLD_FRACTION,
  ROOM_SCALING_INCREMENT,
  GHOST_TRAVEL_SCALE,
  CAMPFIRE_HEAL_FRACTION,
  XP_ROOT_DIVISOR,
  DEFAULT_MUSIC_VOLUME,
  WISH_CHOICE_COUNT,
  MIN_MAX_MANA_FLOOR,
  ELITE_HP_MULTIPLIER,
  BOSS_HEALTH_MULTIPLIER,
  STARTING_TURN,
  ACTS_PER_RUN,
  ENEMY_BASE_REGENERATION,
  AUTO_END_TURN_DELAY,
  VICTORY_TRANSITION_DELAY,
  SLICE_DEATH_DURATION_MS,
  ENEMY_PHASE_DELAY,
  SHAKE_DURATION,
  ATTACK_LUNGE_DURATION_MS,
  COMPANION_ATTACK_DELAY,
  CAMPFIRE_ANIMATION_MS,
  CAMPFIRE_CONTINUE_DELAY,
  SHIMMER_COOLDOWN_MS,
  COMBAT_TEXT_LIFETIME_MS,
  CARD_TRANSFER_CONFIG,
  XP_BASE_PER_POINT,
  XP_TRIANGULAR_MULTIPLIER,
  XP_MIN_THRESHOLD,
  SHOP_CARD_PRICE,
  SHOP_REMOVE_PRICE,
  SHOP_REFRESH_PRICE,
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  ALCHEMIST_MIX_PRICE,
  GOLD_REWARD_MIN,
  GOLD_REWARD_MAX,
  REWARD_CARD_CHOICES,
  DESTINATION_CHOICES,
  COLLECTION_PAGE_SIZE,
  MUSIC_KEYS,
} from "@/lib/game-constants";

// Constants have no behavior of their own; these tests pin only the domains and
// cross-constant orderings that other code relies on. Exact tuning values live
// in src/lib/game-constants/ and are exercised by balance sims, not here.
describe("combat tuning constants", () => {
  it("fraction constants stay within their valid domain", () => {
    // Inside (0, 1]: zero would disable the mechanic.
    for (const value of [
      STUN_THRESHOLD_FRACTION,
      FREEZE_THRESHOLD_FRACTION,
      GHOST_TRAVEL_SCALE,
      CAMPFIRE_HEAL_FRACTION,
      XP_ROOT_DIVISOR,
      DEFAULT_MUSIC_VOLUME,
    ]) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    // Strictly below 1: full value means runaway per-room scaling.
    expect(ROOM_SCALING_INCREMENT).toBeGreaterThan(0);
    expect(ROOM_SCALING_INCREMENT).toBeLessThan(1);
  });

  it("counters, prices, and durations are positive", () => {
    const positive = [
      GLOBAL_CRIT_CHANCE,
      CRIT_MULTIPLIER,
      BLEED_STATUS_MULTIPLIER,
      WISH_CHOICE_COUNT,
      XP_BASE_PER_POINT,
      XP_TRIANGULAR_MULTIPLIER,
      XP_MIN_THRESHOLD,
      SHOP_CARD_PRICE,
      SHOP_REMOVE_PRICE,
      SHOP_REFRESH_PRICE,
      ALCHEMIST_POTION_PRICE,
      ALCHEMIST_REFRESH_PRICE,
      ALCHEMIST_MIX_PRICE,
      REWARD_CARD_CHOICES,
      COLLECTION_PAGE_SIZE,
      AUTO_END_TURN_DELAY,
      VICTORY_TRANSITION_DELAY,
      ENEMY_PHASE_DELAY,
      SHAKE_DURATION,
      ATTACK_LUNGE_DURATION_MS,
      COMPANION_ATTACK_DELAY,
      CAMPFIRE_ANIMATION_MS,
      CAMPFIRE_CONTINUE_DELAY,
      SHIMMER_COOLDOWN_MS,
      COMBAT_TEXT_LIFETIME_MS,
      CARD_TRANSFER_CONFIG.drawDurationSeconds,
      CARD_TRANSFER_CONFIG.discardDurationSeconds,
      CARD_TRANSFER_CONFIG.completionBufferMs,
      CARD_TRANSFER_CONFIG.stableRectTimeoutMs,
    ];
    for (const value of positive) {
      expect(value).toBeGreaterThan(0);
    }
    // GLOBAL_CRIT_CHANCE is percent-domain, not unbounded.
    expect(GLOBAL_CRIT_CHANCE).toBeLessThanOrEqual(100);

    // Floors and non-negative accumulators.
    expect(MIN_MAX_MANA_FLOOR).toBeGreaterThanOrEqual(1);
    expect(ELITE_HP_MULTIPLIER).toBeGreaterThanOrEqual(1);
    expect(BOSS_HEALTH_MULTIPLIER).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(BOSS_HEALTH_MULTIPLIER)).toBe(true);
    expect(REWARD_CARD_CHOICES).toBeGreaterThanOrEqual(1);
    expect(DESTINATION_CHOICES).toBeGreaterThanOrEqual(2);
    expect(ENEMY_BASE_REGENERATION).toBeGreaterThanOrEqual(0);

    // Integer counters start at sane values.
    expect(STARTING_TURN).toBeGreaterThan(0);
    expect(Number.isInteger(STARTING_TURN)).toBe(true);
    expect(ACTS_PER_RUN).toBeGreaterThan(0);
    expect(Number.isInteger(ACTS_PER_RUN)).toBe(true);
  });

  it("keeps cross-constant ordering invariants", () => {
    // Victory must not cut off the slice-death animation.
    expect(VICTORY_TRANSITION_DELAY).toBeGreaterThanOrEqual(SLICE_DEATH_DURATION_MS);
    // Removing a card should cost more than buying one.
    expect(SHOP_REMOVE_PRICE).toBeGreaterThan(SHOP_CARD_PRICE);
    expect(GOLD_REWARD_MIN).toBeLessThanOrEqual(GOLD_REWARD_MAX);
  });

  it("pins the music track ids", () => {
    expect(MUSIC_KEYS.MENU).toBe("menu");
    expect(MUSIC_KEYS.BATTLE).toBe("battle");
  });
});
