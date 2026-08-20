// Campfire rest heal fraction + clamp (base, talent bonus, max Health).
import { describe, expect, it } from "vitest";
import { CAMPFIRE_HEAL_FRACTION, getCampfireHealFraction, getCampfireRestHealth } from "@/lib/game-constants";

describe("campfire rest heal", () => {
  it("uses base fraction with no talent bonus", () => {
    expect(getCampfireHealFraction()).toBe(CAMPFIRE_HEAL_FRACTION);
    expect(getCampfireHealFraction(0)).toBe(CAMPFIRE_HEAL_FRACTION);
    expect(getCampfireRestHealth(10, 30)).toBe(19);
  });

  it("includes talent campfire heal bonus", () => {
    const healFraction = getCampfireHealFraction(0.1);
    expect(healFraction).toBe(0.4);
    expect(getCampfireRestHealth(10, 30, healFraction)).toBe(22);
  });

  it("clamps restored Health to max", () => {
    expect(getCampfireRestHealth(28, 30, CAMPFIRE_HEAL_FRACTION)).toBe(30);
    expect(getCampfireRestHealth(25, 30, 0.4)).toBe(30);
  });

  it("floors fractional heal products", () => {
    expect(getCampfireRestHealth(10, 25)).toBe(17);
  });
});
