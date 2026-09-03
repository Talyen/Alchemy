import { describe, expect, it } from "vitest";
import { pickRandom, rngInt, rollChance, rollPercent, sampleItems, shuffle, takeRandomItem } from "@/lib/rng";

describe("rngInt", () => {
  it("rejects empty and non-integer ranges", () => {
    expect(() => rngInt(() => 0.5, 0)).toThrow();
    expect(() => rngInt(() => 0.5, -2)).toThrow();
    expect(() => rngInt(() => 0.5, 2.5)).toThrow();
    expect(() => rngInt(() => 0.5, Number.NaN)).toThrow();
  });

  it("rejects out-of-range draws", () => {
    expect(() => rngInt(() => 1, 3)).toThrow();
    expect(() => rngInt(() => -0.1, 3)).toThrow();
    expect(() => rngInt(() => Number.NaN, 3)).toThrow();
  });

  it("maps draws to [0, n)", () => {
    expect(rngInt(() => 0, 3)).toBe(0);
    expect(rngInt(() => 0.999999, 3)).toBe(2);
  });
});

describe("shuffle", () => {
  it("pins the exact order for a fixed draw", () => {
    expect(shuffle([1, 2, 3, 4], () => 0.5)).toEqual([1, 4, 2, 3]);
  });

  it("rejects out-of-range draws instead of corrupting the deck", () => {
    expect(() => shuffle([1, 2, 3], () => 1)).toThrow();
    expect(() => shuffle([1, 2, 3], () => Number.NaN)).toThrow();
  });
});

describe("sampleItems", () => {
  it("rejects negative and non-integer counts", () => {
    expect(() => sampleItems([1, 2, 3], -1, () => 0.5)).toThrow();
    expect(() => sampleItems([1, 2, 3], 1.5, () => 0.5)).toThrow();
  });

  it("returns [] for zero count without drawing", () => {
    let draws = 0;
    expect(
      sampleItems([1, 2, 3], 0, () => {
        draws += 1;
        return 0.5;
      }),
    ).toEqual([]);
    expect(draws).toBe(0);
  });
});

describe("pickRandom", () => {
  it("rejects out-of-range draws", () => {
    expect(() => pickRandom([1, 2], () => 1)).toThrow();
    expect(pickRandom([1, 2], () => 0)).toBe(1);
  });
});

describe("takeRandomItem", () => {
  it("rejects out-of-range draws", () => {
    expect(() => takeRandomItem([1, 2], () => 1)).toThrow();
  });
});

describe("rolls", () => {
  it("handles certain and impossible chances without drawing", () => {
    let draws = 0;
    const counting = () => {
      draws += 1;
      return 0.5;
    };
    expect(rollPercent(0, counting)).toBe(false);
    expect(rollPercent(100, counting)).toBe(true);
    expect(rollChance(0, counting)).toBe(false);
    expect(rollChance(1, counting)).toBe(true);
    expect(draws).toBe(0);
  });

  it("agrees across percent and probability scales", () => {
    expect(rollPercent(50, () => 0.49)).toBe(rollChance(0.5, () => 0.49));
    expect(rollPercent(50, () => 0.5)).toBe(rollChance(0.5, () => 0.5));
  });

  it("rejects NaN chances", () => {
    expect(() => rollPercent(Number.NaN, () => 0.5)).toThrow();
    expect(() => rollChance(Number.NaN, () => 0.5)).toThrow();
  });
});
