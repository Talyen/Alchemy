import { describe, expect, it } from "vitest";
import { computeLeechHeal } from "@/lib/battle/damage-rider-leech";

describe("computeLeechHeal", () => {
  it("returns zero for non-positive damage", () => {
    expect(computeLeechHeal(0)).toBe(0);
    expect(computeLeechHeal(-4)).toBe(0);
  });

  it("heals for half the triggering damage rounded", () => {
    expect(computeLeechHeal(4)).toBe(2);
    expect(computeLeechHeal(5)).toBe(3);
  });
});
