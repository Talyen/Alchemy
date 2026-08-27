import { describe, expect, it } from "vitest";
import {
  TALENT_UNLOCK_ANIMATION_MS,
  TALENT_UNLOCK_SPARK_COUNT,
  XP_BASE_PER_POINT,
  XP_MIN_THRESHOLD,
  XP_ROOT_DIVISOR,
  XP_TRIANGULAR_MULTIPLIER,
} from "@/lib/game-constants/progression";

describe("progression constants", () => {
  it("keeps XP tuning positive and in valid domains", () => {
    expect(XP_BASE_PER_POINT).toBeGreaterThan(0);
    expect(XP_TRIANGULAR_MULTIPLIER).toBeGreaterThan(0);
    expect(XP_MIN_THRESHOLD).toBeGreaterThan(0);
    expect(XP_ROOT_DIVISOR).toBeGreaterThan(0);
    expect(XP_ROOT_DIVISOR).toBeLessThanOrEqual(1);
    expect(TALENT_UNLOCK_ANIMATION_MS).toBeGreaterThan(0);
    expect(TALENT_UNLOCK_SPARK_COUNT).toBeGreaterThan(0);
  });
});
