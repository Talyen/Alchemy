import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  appendUnique,
  appendUniqueMany,
  clamp,
  clamp01,
  createInstanceId,
  formatLargeAmount,
  isValidDeckIndex,
} from "@/lib/utils";
import { removeWildwoodCard, createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { applyMixToDeck } from "@/lib/alchemist";
import { makeTestCard } from "../fixtures/cards";

describe("numeric bounds", () => {
  it("keeps invalid volume/opacity inputs bounded and rejects reversed ranges", () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
    expect(() => clamp(5, 10, 0)).toThrow();
  });
});

describe("formatLargeAmount", () => {
  it("maps non-finite amounts to zero", () => {
    expect(formatLargeAmount(Number.NaN)).toBe("0");
    expect(formatLargeAmount(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("createInstanceId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps bulk-generated fallback ids unique when clock and randomness repeat", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Date, "now").mockReturnValue(123);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ids = Array.from({ length: 100 }, createInstanceId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("appendUniqueMany", () => {
  it("retains the base reference for no-op merges, including frozen inputs", () => {
    const base = Object.freeze(["a", "b"]);
    expect(appendUniqueMany(base, [])).toBe(base);
    expect(appendUniqueMany(base, ["b", "a", "b"])).toBe(base);
    expect(appendUnique(base, "a")).toBe(base);
    expect(appendUniqueMany(base, ["b", "c", "c"])).toEqual(["a", "b", "c"]);
    expect(base).toEqual(["a", "b"]);
    expectTypeOf(appendUniqueMany(base, [])).toEqualTypeOf<readonly string[]>();
    expectTypeOf(appendUnique(base, "a")).toEqualTypeOf<readonly string[]>();
    expectTypeOf(appendUniqueMany(["a"], ["b"])).toEqualTypeOf<string[]>();
    expectTypeOf(appendUnique(["a"], "b")).toEqualTypeOf<string[]>();
  });

  it("adds each new identity once, in order, without changing either input", () => {
    const base = Object.freeze(["a", "b"]);
    const additions = Object.freeze(["b", "c", "c", "d"]);
    expect(appendUniqueMany(base, additions)).toEqual(["a", "b", "c", "d"]);
    expect(appendUniqueMany([], additions)).toEqual(["b", "c", "d"]);
    expect(appendUnique(base, "c")).toEqual(["a", "b", "c"]);
    expect(base).toEqual(["a", "b"]);
    expect(additions).toEqual(["b", "c", "c", "d"]);
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

