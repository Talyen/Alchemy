import { describe, expect, it, vi } from "vitest";
import {
  appendUnique,
  appendUniqueMany,
  capitalizeWord,
  clamp,
  createInstanceId,
  createSeededRng,
  formatLargeAmount,
  lerp,
  pickRandom,
  sampleItems,
  shuffle,
  takeRandomItem,
} from "@/lib/utils";

vi.spyOn(Math, "random").mockReturnValue(0.5);

describe("clamp", () => {
  it("returns value when within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("returns min when value is below", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("returns max when value is above", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("handles negative bounds", () => {
    expect(clamp(-10, -20, -5)).toBe(-10);
  });

  it("handles floating point", () => {
    expect(clamp(3.5, 0, 10)).toBe(3.5);
    expect(clamp(-0.5, 0, 10)).toBe(0);
  });

  it("throws when min exceeds max", () => {
    expect(() => clamp(5, 10, 0)).toThrow();
  });
});

describe("lerp", () => {
  it("interpolates linearly between values", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });
});

describe("capitalizeWord", () => {
  it("capitalizes the first letter of words", () => {
    expect(capitalizeWord("hello")).toBe("Hello");
    expect(capitalizeWord("alchemy")).toBe("Alchemy");
    expect(capitalizeWord("a")).toBe("A");
    expect(capitalizeWord("")).toBe("");
  });
});

describe("formatLargeAmount", () => {
  it("formats standard amounts using locale formatting", () => {
    expect(formatLargeAmount(500)).toBe((500).toLocaleString());
    expect(formatLargeAmount(99999)).toBe((99999).toLocaleString());
  });

  it("formats amounts >= 100,000 in compact k notation", () => {
    expect(formatLargeAmount(100000)).toBe("100.0k");
    expect(formatLargeAmount(150500)).toBe("150.5k");
    expect(formatLargeAmount(1000000)).toBe("1000.0k");
  });

  it("maps non-finite amounts to zero", () => {
    expect(formatLargeAmount(Number.NaN)).toBe("0");
    expect(formatLargeAmount(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("shuffle", () => {
  it("returns all items", () => {
    const result = shuffle([1, 2, 3, 4], () => 0.5);
    expect(result).toHaveLength(4);
    expect(result.sort()).toEqual([1, 2, 3, 4]);
  });

  it("does not mutate the original array", () => {
    const input = [1, 2, 3];
    shuffle(input, () => 0.5);
    expect(input).toEqual([1, 2, 3]);
  });

  it("handles empty array", () => {
    expect(shuffle([], () => 0.5)).toEqual([]);
  });

  it("handles single element", () => {
    expect(shuffle([42], () => 0.5)).toEqual([42]);
  });
});

describe("sampleItems", () => {
  it("samples up to count items without replacement", () => {
    const items = [1, 2, 3, 4, 5] as const;
    const sampled = sampleItems(items, 3, () => 0.5);
    expect(sampled).toHaveLength(3);
    expect(new Set(sampled).size).toBe(3);
  });

  it("caps sample count at array length", () => {
    const items = [10, 20];
    const sampled = sampleItems(items, 5, () => 0.5);
    expect(sampled).toHaveLength(2);
  });

  it("returns empty array when count is zero", () => {
    expect(sampleItems([1, 2, 3], 0, () => 0.5)).toEqual([]);
  });
});

describe("pickRandom", () => {
  it("returns the item at the selected index", () => {
    expect(pickRandom([10, 20, 30], () => 0)).toBe(10);
    expect(pickRandom([10, 20, 30], () => 0.5)).toBe(20);
  });

  it("returns undefined for empty array", () => {
    expect(pickRandom([], () => 0.5)).toBeUndefined();
  });

  it("returns the only element for single-element array", () => {
    expect(pickRandom([7], () => 0.5)).toBe(7);
  });
});

describe("takeRandomItem", () => {
  it("returns undefined for empty array", () => {
    expect(takeRandomItem([], () => 0.5)).toBeUndefined();
  });

  it("removes and returns an item from the array", () => {
    const list = ["a", "b", "c"];
    const removed = takeRandomItem(list, () => 0);
    expect(removed).toBe("a");
    expect(list).toEqual(["b", "c"]);
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
});

describe("createInstanceId", () => {
  it("generates non-empty unique string identifiers", () => {
    const id1 = createInstanceId();
    const id2 = createInstanceId();

    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);
    expect(id1).not.toBe(id2);
  });
});

describe("appendUnique", () => {
  it("appends a new item", () => {
    expect(appendUnique([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it("does not append a duplicate", () => {
    expect(appendUnique([1, 2], 2)).toEqual([1, 2]);
  });

  it("does not mutate the original array", () => {
    const input = [1, 2];
    appendUnique(input, 3);
    expect(input).toEqual([1, 2]);
  });

  it("works with strings", () => {
    expect(appendUnique(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(appendUnique(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("handles empty initial array", () => {
    expect(appendUnique([], 1)).toEqual([1]);
  });
});

describe("appendUniqueMany", () => {
  it("merges unique items preserving order", () => {
    expect(appendUniqueMany([1, 2], [2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it("does not mutate original arrays", () => {
    const base = [1, 2];
    const additions = [2, 3];
    appendUniqueMany(base, additions);
    expect(base).toEqual([1, 2]);
    expect(additions).toEqual([2, 3]);
  });

  it("handles empty base", () => {
    expect(appendUniqueMany([], [1, 2])).toEqual([1, 2]);
  });

  it("handles empty additions", () => {
    expect(appendUniqueMany([1, 2], [])).toEqual([1, 2]);
  });

  it("works with strings", () => {
    expect(appendUniqueMany(["a", "b"], ["b", "c", "a"])).toEqual(["a", "b", "c"]);
  });
});
