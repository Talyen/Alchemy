import { describe, it, expect } from "vitest";
import { isValidDeckIndex } from "@/lib/utils";
import { removeWildwoodCard, createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { applyMixToDeck } from "@/lib/alchemist/potion-mixer";
import { makeTestCard } from "../../fixtures/cards";

function card(id: string) {
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
    const deck = [card("a"), card("b"), card("c"), card("d"), card("e"), card("f"), card("g"), card("h")];
    expect(removeWildwoodCard(state, deck, 0.5)).toBeNull();
    expect(removeWildwoodCard(state, deck, NaN)).toBeNull();
    expect(removeWildwoodCard(state, deck, Infinity)).toBeNull();
    expect(removeWildwoodCard(state, deck, -1)).toBeNull();
    expect(removeWildwoodCard(state, deck, 8)).toBeNull();
  });
});

describe("applyMixToDeck", () => {
  it("throws for fractional or NaN indices", () => {
    const deck = [card("a"), card("b"), card("c")];
    const mixed = card("mixed");
    expect(() => applyMixToDeck(deck, 0.5 as unknown as number, 1, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, NaN, 1, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, 0, 1.2, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, 0, 0, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, -1, 1, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, 0, 5, mixed)).toThrow();
  });
  it("succeeds for valid distinct indices", () => {
    const deck = [card("a"), card("b"), card("c")];
    const mixed = card("mixed");
    const result = applyMixToDeck(deck, 0, 1, mixed);
    expect(result).toHaveLength(2);
    expect(result[result.length - 1].id).toBe("mixed");
  });
});
