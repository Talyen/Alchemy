import { describe, expect, it } from "vitest";
import {
  GLOBAL_CRIT_CHANCE,
  CRIT_MULTIPLIER,
  BLEED_STATUS_MULTIPLIER,
  STUN_THRESHOLD_FRACTION,
  FREEZE_THRESHOLD_FRACTION,
  WISH_CHOICE_COUNT,
  MIN_MAX_MANA_FLOOR,
  ROOM_SCALING_INCREMENT,
  ELITE_HP_MULTIPLIER,
  STARTING_TURN,
  ENEMY_BASE_REGENERATION,
  BLEED_EXECUTE_MULTIPLIER,
  AUTO_END_TURN_DELAY,
  SLICE_DEATH_DURATION_MS,
  VICTORY_TRANSITION_DELAY,
  ENEMY_PHASE_DELAY,
  SHAKE_DURATION,
  COMPANION_ATTACK_DELAY,
  CAMPFIRE_ANIMATION_MS,
  CAMPFIRE_CONTINUE_DELAY,
  CAMPFIRE_HEAL_FRACTION,
  XP_BASE_PER_POINT,
  XP_TRIANGULAR_MULTIPLIER,
  XP_MIN_THRESHOLD,
  XP_ROOT_DIVISOR,
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
  ACTS_PER_RUN,
  BOSS_HEALTH_MULTIPLIER,
  MASTER_GAIN,
  DEFAULT_MUSIC_VOLUME,
  MUSIC_BASE_PATH,
  SHIMMER_COOLDOWN_MS,
  COMBAT_TEXT_LIFETIME_MS,
  CARD_TRANSFER_CONFIG,
  GHOST_TRAVEL_SCALE,
  COLLECTION_PAGE_SIZE,
  SAVE_KEY,
  MUSIC_KEYS,
} from "@/lib/game-constants";

describe("Combat constants", () => {
  it("GLOBAL_CRIT_CHANCE is between 0 and 100", () => {
    expect(GLOBAL_CRIT_CHANCE).toBeGreaterThanOrEqual(0);
    expect(GLOBAL_CRIT_CHANCE).toBeLessThanOrEqual(100);
  });

  it("CRIT_MULTIPLIER is positive", () => {
    expect(CRIT_MULTIPLIER).toBeGreaterThan(0);
  });

  it("BLEED_STATUS_MULTIPLIER is positive", () => {
    expect(BLEED_STATUS_MULTIPLIER).toBeGreaterThan(0);
  });

  it("STUN_THRESHOLD_FRACTION is between 0 and 1", () => {
    expect(STUN_THRESHOLD_FRACTION).toBeGreaterThan(0);
    expect(STUN_THRESHOLD_FRACTION).toBeLessThanOrEqual(1);
  });

  it("FREEZE_THRESHOLD_FRACTION is between 0 and 1", () => {
    expect(FREEZE_THRESHOLD_FRACTION).toBeGreaterThan(0);
    expect(FREEZE_THRESHOLD_FRACTION).toBeLessThanOrEqual(1);
  });

  it("WISH_CHOICE_COUNT is positive", () => {
    expect(WISH_CHOICE_COUNT).toBeGreaterThan(0);
  });

  it("MIN_MAX_MANA_FLOOR is at least 1", () => {
    expect(MIN_MAX_MANA_FLOOR).toBeGreaterThanOrEqual(1);
  });
});

describe("Battle / Room constants", () => {
  it("ROOM_SCALING_INCREMENT is between 0 and 1", () => {
    expect(ROOM_SCALING_INCREMENT).toBeGreaterThan(0);
    expect(ROOM_SCALING_INCREMENT).toBeLessThan(1);
  });

  it("ELITE_HP_MULTIPLIER is at least 1", () => {
    expect(ELITE_HP_MULTIPLIER).toBeGreaterThanOrEqual(1);
  });

  it("STARTING_TURN is a positive integer", () => {
    expect(STARTING_TURN).toBeGreaterThan(0);
    expect(Number.isInteger(STARTING_TURN)).toBe(true);
  });

  it("ENEMY_BASE_REGENERATION is non-negative", () => {
    expect(ENEMY_BASE_REGENERATION).toBeGreaterThanOrEqual(0);
  });

  it("BLEED_EXECUTE_MULTIPLIER is at least 1", () => {
    expect(BLEED_EXECUTE_MULTIPLIER).toBeGreaterThanOrEqual(1);
  });
});

describe("Timing constants", () => {
  it("all timing durations are positive", () => {
    expect(AUTO_END_TURN_DELAY).toBeGreaterThan(0);
    expect(VICTORY_TRANSITION_DELAY).toBeGreaterThan(0);
    expect(ENEMY_PHASE_DELAY).toBeGreaterThan(0);
    expect(SHAKE_DURATION).toBeGreaterThan(0);
    expect(COMPANION_ATTACK_DELAY).toBeGreaterThan(0);
    expect(CAMPFIRE_ANIMATION_MS).toBeGreaterThan(0);
    expect(CAMPFIRE_CONTINUE_DELAY).toBeGreaterThan(0);
  });

  it("VICTORY_TRANSITION_DELAY is long enough for death animation", () => {
    expect(VICTORY_TRANSITION_DELAY).toBeGreaterThanOrEqual(SLICE_DEATH_DURATION_MS);
  });
});

describe("Campfire constants", () => {
  it("CAMPFIRE_HEAL_FRACTION is between 0 and 1", () => {
    expect(CAMPFIRE_HEAL_FRACTION).toBeGreaterThan(0);
    expect(CAMPFIRE_HEAL_FRACTION).toBeLessThanOrEqual(1);
  });
});

describe("Talent / XP constants", () => {
  it("XP_BASE_PER_POINT is positive", () => {
    expect(XP_BASE_PER_POINT).toBeGreaterThan(0);
  });

  it("XP_TRIANGULAR_MULTIPLIER is positive", () => {
    expect(XP_TRIANGULAR_MULTIPLIER).toBeGreaterThan(0);
  });

  it("XP_MIN_THRESHOLD is positive", () => {
    expect(XP_MIN_THRESHOLD).toBeGreaterThan(0);
  });

  it("XP_ROOT_DIVISOR is between 0 and 1", () => {
    expect(XP_ROOT_DIVISOR).toBeGreaterThan(0);
    expect(XP_ROOT_DIVISOR).toBeLessThanOrEqual(1);
  });
});

describe("Shop constants", () => {
  it("all shop prices are positive", () => {
    expect(SHOP_CARD_PRICE).toBeGreaterThan(0);
    expect(SHOP_REMOVE_PRICE).toBeGreaterThan(0);
    expect(SHOP_REFRESH_PRICE).toBeGreaterThan(0);
    expect(ALCHEMIST_POTION_PRICE).toBeGreaterThan(0);
    expect(ALCHEMIST_REFRESH_PRICE).toBeGreaterThan(0);
    expect(ALCHEMIST_MIX_PRICE).toBeGreaterThan(0);
  });

  it("REMOVE_PRICE is higher than CARD_PRICE (remove should cost more)", () => {
    expect(SHOP_REMOVE_PRICE).toBeGreaterThan(SHOP_CARD_PRICE);
  });
});

describe("Reward constants", () => {
  it("GOLD_REWARD_MIN <= GOLD_REWARD_MAX", () => {
    expect(GOLD_REWARD_MIN).toBeLessThanOrEqual(GOLD_REWARD_MAX);
  });

  it("REWARD_CARD_CHOICES is at least 1", () => {
    expect(REWARD_CARD_CHOICES).toBeGreaterThanOrEqual(1);
  });

  it("DESTINATION_CHOICES is at least 2", () => {
    expect(DESTINATION_CHOICES).toBeGreaterThanOrEqual(2);
  });

  it("ACTS_PER_RUN is a positive integer", () => {
    expect(ACTS_PER_RUN).toBeGreaterThan(0);
    expect(Number.isInteger(ACTS_PER_RUN)).toBe(true);
  });

  it("BOSS_HEALTH_MULTIPLIER is at least 1", () => {
    expect(BOSS_HEALTH_MULTIPLIER).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(BOSS_HEALTH_MULTIPLIER)).toBe(true);
  });
});

describe("Audio constants", () => {
  it("MASTER_GAIN is between 0 and 1", () => {
    expect(MASTER_GAIN).toBeGreaterThan(0);
    expect(MASTER_GAIN).toBeLessThanOrEqual(1);
  });

  it("DEFAULT_MUSIC_VOLUME is between 0 and 1", () => {
    expect(DEFAULT_MUSIC_VOLUME).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_MUSIC_VOLUME).toBeLessThanOrEqual(1);
  });

  it("MUSIC_BASE_PATH is a non-empty string", () => {
    expect(MUSIC_BASE_PATH).toBeTruthy();
    expect(typeof MUSIC_BASE_PATH).toBe("string");
  });
});

describe("Animation constants", () => {
  it("SHIMMER_COOLDOWN_MS is positive", () => {
    expect(SHIMMER_COOLDOWN_MS).toBeGreaterThan(0);
  });

  it("COMBAT_TEXT_LIFETIME_MS is positive", () => {
    expect(COMBAT_TEXT_LIFETIME_MS).toBeGreaterThan(0);
  });
  it("CARD_TRANSFER_CONFIG timing values are positive", () => {
    expect(CARD_TRANSFER_CONFIG.drawDurationSeconds).toBeGreaterThan(0);
    expect(CARD_TRANSFER_CONFIG.discardDurationSeconds).toBeGreaterThan(0);
    expect(CARD_TRANSFER_CONFIG.completionBufferMs).toBeGreaterThan(0);
    expect(CARD_TRANSFER_CONFIG.stableRectTimeoutMs).toBeGreaterThan(0);
  });
});

describe("Layout constants", () => {
  it("GHOST_TRAVEL_SCALE is between 0 and 1", () => {
    expect(GHOST_TRAVEL_SCALE).toBeGreaterThan(0);
    expect(GHOST_TRAVEL_SCALE).toBeLessThan(1);
  });
});

describe("Collection constants", () => {
  it("COLLECTION_PAGE_SIZE is positive", () => {
    expect(COLLECTION_PAGE_SIZE).toBeGreaterThan(0);
  });
});

describe("Storage constants", () => {
  it("SAVE_KEY is a non-empty string", () => {
    expect(SAVE_KEY).toBeTruthy();
    expect(typeof SAVE_KEY).toBe("string");
  });
});

describe("MUSIC_KEYS enum", () => {
  it("has the expected keys", () => {
    expect(MUSIC_KEYS.MENU).toBe("menu");
    expect(MUSIC_KEYS.BATTLE).toBe("battle");
  });
});
