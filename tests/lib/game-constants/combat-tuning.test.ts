import { describe, expect, it } from "vitest";
import {
  CAMPFIRE_HEAL_FRACTION,
  FIGHT_PACING,
  FREEZE_THRESHOLD_FRACTION,
  GOLD_REWARD_MAX,
  GOLD_REWARD_MIN,
  ROOM_SCALING_INCREMENT,
  SHOP_CARD_PRICE,
  SHOP_REMOVE_PRICE,
  STUN_THRESHOLD_FRACTION,
} from "@/lib/game-constants";

describe("game-constants contracts", () => {
  it("keeps economy ranges ordered", () => {
    expect(SHOP_REMOVE_PRICE).toBeGreaterThan(SHOP_CARD_PRICE);
    expect(GOLD_REWARD_MIN).toBeLessThanOrEqual(GOLD_REWARD_MAX);
  });

  it("keeps combat fraction domains valid", () => {
    for (const value of [STUN_THRESHOLD_FRACTION, FREEZE_THRESHOLD_FRACTION, CAMPFIRE_HEAL_FRACTION]) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(ROOM_SCALING_INCREMENT).toBeGreaterThan(0);
    expect(ROOM_SCALING_INCREMENT).toBeLessThan(1);
  });

  it("keeps fight-pacing enemy clocks ordered by difficulty", () => {
    const { normal, elite, boss } = FIGHT_PACING.clockByEnemyType;
    expect(normal.targetDuration).toBeLessThan(elite.targetDuration);
    expect(elite.targetDuration).toBeLessThan(boss.targetDuration);
    expect(normal.maxRounds).toBeLessThan(elite.maxRounds);
    expect(elite.maxRounds).toBeLessThan(boss.maxRounds);
  });
});
