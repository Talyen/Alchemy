import { describe, expect, it } from "vitest";
import {
  appendUnique,
  appendUniqueMany,
  capitalizeWord,
  clamp,
  clamp01,
  createInstanceId,
  formatLargeAmount,
  isValidDeckIndex,
  lerp,
} from "@/lib/utils";
import { removeWildwoodCard, createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { applyMixToDeck } from "@/lib/alchemist";
import { createNumericManifest, mergeNumericManifests } from "@/lib/manifest-utils";
import { makeTestCard } from "../fixtures/cards";

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

describe("clamp01", () => {
  it("keeps nonnumeric slider values out of volume and opacity sinks", () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
  it("returns value when within [0, 1]", () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });

  it("clamps values below 0 to 0", () => {
    expect(clamp01(-0.1)).toBe(0);
    expect(clamp01(-100)).toBe(0);
  });

  it("clamps values above 1 to 1", () => {
    expect(clamp01(1.1)).toBe(1);
    expect(clamp01(100)).toBe(1);
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

function makeCard(id: string) {
  return makeTestCard({ id, cost: 1, effects: [] });
}

describe("isValidDeckIndex", () => {
  it("accepts valid integer indices", () => {
    expect(isValidDeckIndex(0, 3)).toBe(true);
    expect(isValidDeckIndex(2, 3)).toBe(true);
  });
  it("rejects fractional, NaN, Infinity, out of bounds", () => {
    expect(isValidDeckIndex(0.5, 3)).toBe(false);
    expect(isValidDeckIndex(NaN, 3)).toBe(false);
    expect(isValidDeckIndex(Infinity, 3)).toBe(false);
    expect(isValidDeckIndex(-1, 3)).toBe(false);
    expect(isValidDeckIndex(3, 3)).toBe(false);
    expect(isValidDeckIndex(10, 3)).toBe(false);
  });
});

describe("removeWildwoodCard", () => {
  it("rejects non-integer indices", () => {
    const state = { ...createInitialWildwoodDraftState("knight", () => 0.5), phase: "removal" as const };
    const deck = [
      makeCard("a"),
      makeCard("b"),
      makeCard("c"),
      makeCard("d"),
      makeCard("e"),
      makeCard("f"),
      makeCard("g"),
      makeCard("h"),
    ];
    expect(removeWildwoodCard(state, deck, 0.5)).toBeNull();
    expect(removeWildwoodCard(state, deck, NaN)).toBeNull();
    expect(removeWildwoodCard(state, deck, Infinity)).toBeNull();
    expect(removeWildwoodCard(state, deck, -1)).toBeNull();
    expect(removeWildwoodCard(state, deck, 8)).toBeNull();
  });
});

describe("applyMixToDeck", () => {
  it("throws for fractional or NaN indices", () => {
    const deck = [makeCard("a"), makeCard("b"), makeCard("c")];
    const mixed = makeCard("mixed");
    expect(() => applyMixToDeck(deck, 0.5 as unknown as number, 1, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, NaN, 1, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, 0, 1.2, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, 0, 0, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, -1, 1, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, 0, 5, mixed)).toThrow();
  });
  it("succeeds for valid distinct indices", () => {
    const deck = [makeCard("a"), makeCard("b"), makeCard("c")];
    const mixed = makeCard("mixed");
    const result = applyMixToDeck(deck, 0, 1, mixed);
    expect(result).toHaveLength(2);
    expect(result[result.length - 1].id).toBe("mixed");
  });
});

describe("manifest utilities", () => {
  it("creates a zeroed manifest for each declared key", () => {
    expect(createNumericManifest(["damage", "block"] as const)).toEqual({ damage: 0, block: 0 });
  });

  it("merges numeric values while preserving the declared shape", () => {
    const keys = ["damage", "block"] as const;
    const base = { damage: 3, block: 4 };
    const addition = { damage: 2, block: 1 };

    expect(mergeNumericManifests(base, addition, keys)).toEqual({ damage: 5, block: 5 });
    expect(base).toEqual({ damage: 3, block: 4 });
    expect(addition).toEqual({ damage: 2, block: 1 });
  });
});
