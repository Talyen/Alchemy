import { describe, expect, it } from "vitest";
import { isDeltaNoisy, makePairedDelta, pairedDeltaSE, proportionSE } from "@/lib/balance/report-rankings";
import { insertCardIntoDeck, removeCardIdFromDeck } from "@/lib/balance/class-deck";
import { cardLibrary } from "@/lib/game-data";

describe("paired delta noise", () => {
  it("computes a positive SE for interior rates", () => {
    expect(proportionSE(0.5, 100)).toBeGreaterThan(0);
    expect(pairedDeltaSE(0.6, 0.5, 100)).toBeGreaterThan(0);
  });

  it("marks tiny deltas as noisy", () => {
    const delta = makePairedDelta("x", 0.51, 0.5, 20);
    expect(delta.noisy).toBe(true);
    expect(isDeltaNoisy(0.3, 0.05)).toBe(false);
  });
});

describe("paired deck helpers", () => {
  it("inserts a missing card without changing an already-present id", () => {
    const card = cardLibrary[0]!;
    const other = cardLibrary[1]!;
    const withCard = insertCardIntoDeck([other], card);
    expect(withCard.map((entry) => entry.id)).toEqual([other.id, card.id]);
    expect(insertCardIntoDeck(withCard, card)).toHaveLength(2);
    expect(removeCardIdFromDeck(withCard, card.id).map((entry) => entry.id)).toEqual([other.id]);
  });
});
