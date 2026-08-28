import { describe, expect, it } from "vitest";
import {
  CAMPFIRE_HEAL_FRACTION,
  DROP_RATES_BOSS,
  DROP_RATES_NORMAL,
  EQUIPMENT_SHOP_DROP_RATES,
  FIGHT_PACING,
  FREEZE_THRESHOLD_FRACTION,
  GEAR_REWARD_PERMANENT_TRINKET_CHANCE,
  GOLD_REWARD_MAX,
  GOLD_REWARD_MIN,
  ROOM_SCALING_INCREMENT,
  SHOP_CARD_PRICE,
  SHOP_REMOVE_PRICE,
  SLICE_DEATH_DURATION_MS,
  STUN_THRESHOLD_FRACTION,
  VICTORY_TRANSITION_DELAY,
  WISH_OVERLAY_Z_INDEX,
} from "@/lib/game-constants";

describe("game-constants contracts", () => {
  it("keeps presentation and economy orderings", () => {
    expect(VICTORY_TRANSITION_DELAY).toBeGreaterThanOrEqual(SLICE_DEATH_DURATION_MS);
    expect(SHOP_REMOVE_PRICE).toBeGreaterThan(SHOP_CARD_PRICE);
    expect(GOLD_REWARD_MIN).toBeLessThanOrEqual(GOLD_REWARD_MAX);
    expect(WISH_OVERLAY_Z_INDEX).toBe(90);
  });

  it("keeps combat fraction domains valid", () => {
    for (const value of [STUN_THRESHOLD_FRACTION, FREEZE_THRESHOLD_FRACTION, CAMPFIRE_HEAL_FRACTION]) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(ROOM_SCALING_INCREMENT).toBeGreaterThan(0);
    expect(ROOM_SCALING_INCREMENT).toBeLessThan(1);
  });

  it("keeps drop-rate tables in valid probability domains", () => {
    const shopSum =
      EQUIPMENT_SHOP_DROP_RATES.unique + EQUIPMENT_SHOP_DROP_RATES.astral + EQUIPMENT_SHOP_DROP_RATES.basic;
    expect(shopSum).toBeCloseTo(1);

    expect(DROP_RATES_NORMAL.unique).toBeGreaterThan(0);
    expect(DROP_RATES_NORMAL.astral).toBeGreaterThan(0);
    expect(DROP_RATES_NORMAL.unique + DROP_RATES_NORMAL.astral).toBeLessThan(1);

    expect(DROP_RATES_BOSS.unique).toBeGreaterThan(0);
    expect(DROP_RATES_BOSS.unique).toBeLessThan(1);

    for (const chance of Object.values(GEAR_REWARD_PERMANENT_TRINKET_CHANCE)) {
      expect(chance).toBeGreaterThan(0);
      expect(chance).toBeLessThanOrEqual(1);
    }
  });

  it("keeps fight-pacing enemy clocks ordered by difficulty", () => {
    const { normal, elite, boss } = FIGHT_PACING.clockByEnemyType;
    expect(normal.targetDuration).toBeLessThan(elite.targetDuration);
    expect(elite.targetDuration).toBeLessThan(boss.targetDuration);
    expect(normal.maxRounds).toBeLessThan(elite.maxRounds);
    expect(elite.maxRounds).toBeLessThan(boss.maxRounds);
  });
});
