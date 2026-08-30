import { describe, expect, it } from "vitest";
import {
  combinePairedWinStats,
  emptyPairedWinStats,
  isDeltaNoisy,
  makePairedDelta,
  pairedWinStats,
} from "@/lib/balance/report-rankings";
import { insertCardIntoDeck, removeCardIdFromDeck } from "@/lib/balance/class-deck";
import { cardLibrary } from "@/lib/game-data";

describe("paired delta noise", () => {
  it("uses per-seed differences and preserves perfect correlation", () => {
    const outcomes = Uint8Array.from([1, 0, 1, 0]);
    const delta = makePairedDelta("same", pairedWinStats(outcomes, outcomes));
    expect(delta.delta).toBe(0);
    expect(delta.se).toBe(0);
    expect(delta.n).toBe(4);
  });

  it("computes sample error from mixed paired differences", () => {
    const baseline = Uint8Array.from([1, 0, 1, 0]);
    const treatment = Uint8Array.from([1, 1, 0, 0]);
    const delta = makePairedDelta("mixed", pairedWinStats(baseline, treatment));
    expect(delta.delta).toBe(0);
    expect(delta.se).toBeCloseTo(Math.sqrt(1 / 6));
    expect(delta.noisy).toBe(true);
  });

  it("combines scenario sufficient statistics like concatenated series", () => {
    const first = pairedWinStats(Uint8Array.from([1, 0]), Uint8Array.from([1, 1]));
    const second = pairedWinStats(Uint8Array.from([1, 1]), Uint8Array.from([0, 1]));
    const combined = makePairedDelta("combined", combinePairedWinStats([first, second]));
    const concatenated = makePairedDelta(
      "combined",
      pairedWinStats(Uint8Array.from([1, 0, 1, 1]), Uint8Array.from([1, 1, 0, 1])),
    );
    expect(combined).toEqual(concatenated);
  });

  it("marks empty and one-sample comparisons as insufficient", () => {
    expect(makePairedDelta("empty", emptyPairedWinStats()).noisy).toBe(true);
    expect(makePairedDelta("single", pairedWinStats(Uint8Array.from([0]), Uint8Array.from([1]))).noisy).toBe(true);
    expect(isDeltaNoisy(0.3, 0.05)).toBe(false);
  });

  it("rejects mismatched series", () => {
    expect(() => pairedWinStats(Uint8Array.from([0]), Uint8Array.from([0, 1]))).toThrow("equal lengths");
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
