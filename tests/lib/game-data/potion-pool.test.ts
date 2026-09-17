import { describe, expect, it } from "vitest";
import { getStandardPotionPool, isPotionCard, isStandardPotionCard } from "@/lib/game-data/cards/card-pools";
import { cardLibrary } from "@/lib/game-data";

describe("getStandardPotionPool", () => {
  it("returns only standard potion cards", () => {
    const pool = getStandardPotionPool();
    expect(pool.length).toBeGreaterThan(0);
    for (const card of pool) {
      expect(isStandardPotionCard(card)).toBe(true);
      expect(card.id).not.toBe("mixed-potion");
    }
  });

  it("contains exactly the Distillation-eligible standard potions", () => {
    const poolIds = new Set(getStandardPotionPool().map((card) => card.id));
    expect(poolIds).toEqual(
      new Set([
        "health-potion",
        "mana-potion",
        "panacea-potion",
        "stoneskin-potion",
        "acid-potion",
        "luck-potion",
        "wishing-potion",
      ]),
    );
  });

  it("returns a copy so callers cannot corrupt the cached pool", () => {
    const first = getStandardPotionPool();
    first.pop();
    first.splice(0, first.length);
    expect(getStandardPotionPool().length).toBe(7);
  });

  it("excludes mixed potion cards from the library", () => {
    const mixed = cardLibrary.filter((card) => card.id.startsWith("mixed-potion"));
    const poolIds = new Set(getStandardPotionPool().map((card) => card.id));
    for (const card of mixed) {
      expect(poolIds.has(card.id)).toBe(false);
    }
  });
});

describe("isStandardPotionCard", () => {
  it("accepts standard potions", () => {
    expect(isStandardPotionCard({ id: "health-potion" })).toBe(true);
  });

  it("rejects mixed potion ids", () => {
    expect(isStandardPotionCard({ id: "mixed-potion" })).toBe(false);
    expect(isStandardPotionCard({ id: "mixed-potion-123" })).toBe(false);
  });

  it("rejects non-potion cards", () => {
    expect(isStandardPotionCard({ id: "slash" })).toBe(false);
  });
});

describe("isPotionCard", () => {
  it("includes the base mixed potion so battle perks apply to it", () => {
    expect(isPotionCard({ id: "mixed-potion" })).toBe(true);
  });

  it("includes composite mixed ids and excludes non-potions", () => {
    expect(isPotionCard({ id: "mixed-potion-health-potion-a1-mana-potion-b2" })).toBe(true);
    expect(isPotionCard({ id: "slash" })).toBe(false);
  });

  it("includes every standard potion", () => {
    for (const id of [
      "health-potion",
      "mana-potion",
      "panacea-potion",
      "stoneskin-potion",
      "acid-potion",
      "luck-potion",
      "wishing-potion",
    ]) {
      expect(isPotionCard({ id })).toBe(true);
    }
  });

  it("excludes similar one-use cards that are not Potions", () => {
    for (const id of ["mana-berries", "mana-crystals", "apple", "bread"]) {
      expect(isPotionCard({ id })).toBe(false);
      expect(isStandardPotionCard({ id })).toBe(false);
    }
  });

  it("does not admit future -potion ids by suffix alone", () => {
    expect(isPotionCard({ id: "brand-new-potion" })).toBe(false);
    expect(isStandardPotionCard({ id: "brand-new-potion" })).toBe(false);
  });
});
