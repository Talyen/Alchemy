import { describe, expect, it } from "vitest";
import { getStandardPotionPool, isPotionCard, isStandardPotionCard } from "@/lib/game-data/cards/card-pools";
import { cardLibrary } from "@/lib/game-data";

describe("getStandardPotionPool", () => {
  it("returns only standard potion cards", () => {
    const pool = getStandardPotionPool();
    expect(pool.length).toBeGreaterThan(0);
    for (const card of pool) {
      expect(isStandardPotionCard(card)).toBe(true);
      expect(card.id).toMatch(/-potion$/);
      expect(card.id).not.toBe("mixed-potion");
    }
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

  it("excludes composite mixed ids and non-potions", () => {
    expect(isPotionCard({ id: "mixed-potion-health-potion-a1-mana-potion-b2" })).toBe(false);
    expect(isPotionCard({ id: "slash" })).toBe(false);
  });
});
