import { describe, expect, it } from "vitest";
import {
  createSeededRng,
  getBattleRng,
  hashStringToUint32,
  pickRandom,
  pickRandomUnsafe,
  placeholderRng,
  rngInt,
  rollChance,
  rollPercent,
  sampleItems,
  shuffle,
  takeRandomItem,
} from "@/lib/rng";

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

  it("does not mutate the original array", () => {
    const original = [1, 2, 3];
    const shuffled = shuffle(original, () => 0.5);
    expect(original).toEqual([1, 2, 3]);
    expect(shuffled).toHaveLength(3);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffle([], () => 0.5)).toEqual([]);
    expect(shuffle([42], () => 0.5)).toEqual([42]);
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

  it("samples up to count items without replacement", () => {
    const items = [1, 2, 3, 4, 5] as const;
    const sampled = sampleItems(items, 3, () => 0.5);
    expect(sampled).toHaveLength(3);
    expect(new Set(sampled).size).toBe(3);
  });

  it("caps sample count at array length and handles empty input", () => {
    expect(sampleItems([10, 20], 5, () => 0.5)).toHaveLength(2);
    expect(sampleItems([], 3, () => 0.5)).toEqual([]);
  });
});

describe("pickRandom", () => {
  it("rejects out-of-range draws", () => {
    expect(() => pickRandom([1, 2], () => 1)).toThrow();
    expect(pickRandom([1, 2], () => 0)).toBe(1);
  });

  it("returns the item at the selected index", () => {
    expect(pickRandom([10, 20, 30], () => 0)).toBe(10);
    expect(pickRandom([10, 20, 30], () => 0.5)).toBe(20);
  });

  it("returns undefined for empty array and element for single element", () => {
    expect(pickRandom([], () => 0.5)).toBeUndefined();
    expect(pickRandom([7], () => 0.5)).toBe(7);
  });
});

describe("takeRandomItem", () => {
  it("rejects out-of-range draws", () => {
    expect(() => takeRandomItem([1, 2], () => 1)).toThrow();
  });

  it("removes and returns an item from the array", () => {
    const list = ["a", "b", "c"];
    const removed = takeRandomItem(list, () => 0);
    expect(removed).toBe("a");
    expect(list).toEqual(["b", "c"]);
  });

  it("returns undefined for empty array", () => {
    expect(takeRandomItem([], () => 0.5)).toBeUndefined();
  });
});

describe("pickRandomUnsafe", () => {
  it("returns undefined for empty array", () => {
    expect(pickRandomUnsafe([])).toBeUndefined();
  });

  it("picks an element from non-empty array", () => {
    const items = ["alpha", "beta", "gamma"];
    const picked = pickRandomUnsafe(items);
    expect(items).toContain(picked);
  });
});

describe("createSeededRng", () => {
  it("produces deterministic pseudo-random sequences for a seed", () => {
    const rng1 = createSeededRng(12345);
    const rng2 = createSeededRng(12345);

    const seq1 = [rng1(), rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2(), rng2()];

    expect(seq1).toEqual(seq2);
    expect(seq1.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("produces different sequences for different seeds", () => {
    const rng1 = createSeededRng(111);
    const rng2 = createSeededRng(222);

    expect(rng1()).not.toBe(rng2());
  });

  it("handles non-finite and negative seeds safely", () => {
    const rngNan = createSeededRng(Number.NaN);
    const val = rngNan();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });
});

describe("hashStringToUint32", () => {
  it("produces deterministic 32-bit unsigned hashes", () => {
    const hash1 = hashStringToUint32("salvage:item-123");
    const hash2 = hashStringToUint32("salvage:item-123");
    expect(hash1).toBe(hash2);
    expect(hash1).toBeGreaterThanOrEqual(0);
    expect(hash1).toBeLessThanOrEqual(0xffff_ffff);
    expect(Number.isInteger(hash1)).toBe(true);
  });

  it("produces different hashes for distinct strings", () => {
    expect(hashStringToUint32("alpha")).not.toBe(hashStringToUint32("beta"));
  });

  it("hashes empty string", () => {
    expect(hashStringToUint32("")).toBe(2166136261);
  });
});

describe("placeholderRng and getBattleRng", () => {
  it("placeholderRng returns 0", () => {
    expect(placeholderRng()).toBe(0);
  });

  it("getBattleRng returns state rng when present", () => {
    const rng = () => 0.42;
    expect(getBattleRng({ rng })).toBe(rng);
  });

  it("getBattleRng throws when rng is missing", () => {
    expect(() => getBattleRng({})).toThrow(/BattleState.rng is required/);
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
