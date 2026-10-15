import { describe, expect, it } from "vitest";
import { CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";
import { getCampfireRestHealth } from "@/lib/campfire-heal";

describe("campfire rest heal", () => {
  it("clamps restored Health to max", () => {
    expect(getCampfireRestHealth(28, 30, CAMPFIRE_HEAL_FRACTION)).toBe(30);
    expect(getCampfireRestHealth(25, 30, 0.4)).toBe(30);
  });

  it("rounds fractional heal products", () => {
    expect(getCampfireRestHealth(10, 25)).toBe(18);
  });
});
