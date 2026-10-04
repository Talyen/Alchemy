import { describe, expect, it } from "vitest";
import {
  createSeededRng,
  getBattleRng,
  hashStringToUint32,
  pickRandom,
  pickWeighted,
  rngInt,
  rollChance,
  rollPercent,
  sampleItems,
  sampleItemsExcluding,
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

describe("sampleItems", () => {
  it("rejects negative and non-integer counts", () => {
    const rng = () => {
      throw new Error("Invalid counts must not draw");
    };
    for (const count of [-1, 1.5, NaN, Infinity]) {
      expect(() => sampleItems([1, 2, 3], count, rng)).toThrow("sampleItems requires a non-negative integer count");
      expect(() => sampleItemsExcluding([1, 2, 3], count, rng, new Set(), (item) => item)).toThrow(
        "sampleItems requires a non-negative integer count",
      );
    }
  });

  it("preserves seeded sample order and subsequent draws without mutating the input", () => {
    const items = Object.freeze(["a", "b", "c", "d", "e", "f"]);
    const excluded = new Set(["b", "e"]);
    // Reference the original full Fisher-Yates shuffle followed by a slice.
    const referenceSample = (pool: readonly string[], count: number, rng: () => number) => {
      if (count === 0) return [];
      const shuffled = [...pool];
      for (let index = shuffled.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(rng() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
      }
      return shuffled.slice(0, Math.min(count, shuffled.length));
    };
    for (const seed of [0, 1, 42, 0xffffffff]) {
      for (const count of [0, 1, 3, 6, 10]) {
        for (const skipExcluded of [false, true]) {
          const actualRng = createSeededRng(seed);
          const expectedRng = createSeededRng(seed);
          const pool = skipExcluded ? items.filter((item) => !excluded.has(item)) : items;
          const actual = skipExcluded
            ? sampleItemsExcluding(items, count, actualRng, excluded, (item) => item)
            : sampleItems(items, count, actualRng);
          expect(actual).toEqual(referenceSample(pool, count, expectedRng));
          expect(actualRng()).toBe(expectedRng());
          expect(actual).not.toBe(items);
        }
      }
    }
    expect(items).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("sampleItemsExcluding", () => {
  const entries = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] as const;
  const keyOf = (entry: { id: string }) => entry.id;

  it("returns [] when everything is excluded", () => {
    expect(
      sampleItemsExcluding(
        entries,
        2,
        () => {
          throw new Error("Empty pools must not draw");
        },
        new Set(["a", "b", "c", "d"]),
        keyOf,
      ),
    ).toEqual([]);
  });
});

describe("pickRandom", () => {
  it("rejects out-of-range draws", () => {
    expect(() => pickRandom([1, 2], () => 1)).toThrow();
    expect(pickRandom([1, 2], () => 0)).toBe(1);
  });

  it("preserves stream position for empty and singleton reward pools", () => {
    let draws = 0;
    const rng = () => {
      draws++;
      return 0.5;
    };
    expect(pickRandom([], rng)).toBeUndefined();
    expect(draws).toBe(0);
    expect(pickRandom([7], rng)).toBe(7);
    expect(draws).toBe(1);
  });
});

describe("pickWeighted", () => {
  const entries = Object.freeze([
    Object.freeze({ id: "disabled-first", weight: 0 }),
    Object.freeze({ id: "first", weight: 1 }),
    Object.freeze({ id: "disabled-middle", weight: 0 }),
    Object.freeze({ id: "second", weight: 3 }),
    Object.freeze({ id: "disabled-last", weight: 0 }),
  ]);
  const weightOf = (entry: { weight: number }) => entry.weight;

  it("uses half-open buckets and never selects zero-weight entries", () => {
    for (const [draw, id] of [
      [0, "first"],
      [0.249999, "first"],
      [0.25, "second"],
      [0.999999, "second"],
    ] as const) {
      expect(pickWeighted(entries, weightOf, () => draw)?.id).toBe(id);
    }
  });

  it("does not draw from empty or all-zero pools", () => {
    const rng = () => {
      throw new Error("unexpected draw");
    };
    expect(pickWeighted([], weightOf, rng)).toBeUndefined();
    expect(pickWeighted([{ weight: 0 }], weightOf, rng)).toBeUndefined();
  });

  it("falls back to the last positive entry when floating-point subtraction exhausts the buckets", () => {
    const weights = [Number.MIN_VALUE, Number.MIN_VALUE, 0];
    expect(
      pickWeighted(
        weights.map((weight, id) => ({ id, weight })),
        weightOf,
        () => 1 - Number.EPSILON / 2,
      )?.id,
    ).toBe(1);
  });

  it("evaluates each weight once and consumes one draw even for a single eligible item", () => {
    let evaluations = 0;
    let draws = 0;
    expect(
      pickWeighted(
        entries.slice(0, 2),
        (entry) => {
          evaluations++;
          return entry.weight;
        },
        () => {
          draws++;
          return 0.5;
        },
      ),
    ).toBe(entries[1]);
    expect(evaluations).toBe(2);
    expect(draws).toBe(1);
  });

  it.each([-1, NaN, Infinity, -Infinity])("rejects invalid weight %s before drawing", (weight) => {
    expect(() =>
      pickWeighted([{ weight: 1 }, { weight }], weightOf, () => {
        throw new Error("unexpected draw");
      }),
    ).toThrow("pickWeighted requires finite non-negative weights");
  });

  it("rejects overflowing totals before drawing", () => {
    expect(() =>
      pickWeighted(
        [Number.MAX_VALUE, Number.MAX_VALUE],
        (weight) => weight,
        () => {
          throw new Error("unexpected draw");
        },
      ),
    ).toThrow("pickWeighted requires a finite total weight");
  });

  it.each([-0.1, 1, NaN, Infinity])("rejects out-of-range draw %s", (draw) => {
    expect(() => pickWeighted(entries, weightOf, () => draw)).toThrow("Rng draw out of range");
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
});

describe("createSeededRng", () => {
  it("preserves the seeded sequence used by saved runs", () => {
    const rng = createSeededRng(12345);
    expect(Array.from({ length: 4 }, () => rng())).toEqual([
      0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203,
    ]);
  });
});

describe("hashStringToUint32", () => {
  it("preserves the hash that seeds salvage previews", () => {
    expect(hashStringToUint32("salvage:item-123")).toBe(834049458);
  });
});

describe("getBattleRng", () => {
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
    expect(rollPercent(50, () => 0.49)).toBe(true);
    expect(rollChance(0.5, () => 0.49)).toBe(true);
    expect(rollPercent(50, () => 0.5)).toBe(false);
    expect(rollChance(0.5, () => 0.5)).toBe(false);
  });

  it("rejects NaN chances", () => {
    expect(() => rollPercent(Number.NaN, () => 0.5)).toThrow();
    expect(() => rollChance(Number.NaN, () => 0.5)).toThrow();
  });
});
