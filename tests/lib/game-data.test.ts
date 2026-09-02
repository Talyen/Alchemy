import { describe, expect, it } from "vitest";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { cardLibrary, companionLibrary, enemyBestiary, trinketLibrary } from "@/lib/game-data";
import { placeholderEnemy } from "@/lib/game-data/assets";
import { MIXED_POTION_CARD_ID } from "@/lib/game-constants";

describe("cardLibrary data integrity", () => {
  it("all card IDs are unique", () => {
    const ids = cardLibrary.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each card has valid cost (0 or positive)", () => {
    for (const card of cardLibrary) {
      expect(card.cost).toBeGreaterThanOrEqual(0);
    }
  });

  it("each card has a non-empty title and art", () => {
    for (const card of cardLibrary) {
      expect(card.title).toBeTruthy();
      expect(card.art).toBeTruthy();
    }
  });

  it("each card has at least one effect", () => {
    for (const card of cardLibrary) {
      if (card.id === "mixed-potion") continue;
      expect(card.effects.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("all summon-companion effects reference valid companion IDs", () => {
    const companionIds = new Set(Object.keys(companionLibrary));
    for (const card of cardLibrary) {
      for (const effect of card.effects) {
        if (effect.kind === "summon-companion") {
          expect(companionIds.has(effect.companionId)).toBe(true);
        }
      }
    }
  });
});

describe("getOfferableCardPool", () => {
  it("includes every library card except mixed potion", () => {
    const poolIds = new Set(getOfferableCardPool().map((card) => card.id));
    for (const card of cardLibrary) {
      if (card.id === MIXED_POTION_CARD_ID) {
        expect(poolIds.has(card.id)).toBe(false);
      } else {
        expect(poolIds.has(card.id)).toBe(true);
      }
    }
  });
});

describe("enemyBestiary data integrity", () => {
  it("contains the complete 39-enemy roster and assigned tier split", () => {
    expect(enemyBestiary).toHaveLength(39);
    expect(enemyBestiary.filter((enemy) => enemy.enemyType === "normal")).toHaveLength(12);
    expect(enemyBestiary.filter((enemy) => enemy.enemyType === "elite")).toHaveLength(20);
    expect(enemyBestiary.filter((enemy) => enemy.enemyType === "boss")).toHaveLength(7);
  });

  it("all enemy IDs are unique", () => {
    const ids = enemyBestiary.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each enemy has a valid enemyType", () => {
    for (const enemy of enemyBestiary) {
      expect(["normal", "elite", "boss"]).toContain(enemy.enemyType);
    }
  });

  it("each enemy has a title and art", () => {
    for (const enemy of enemyBestiary) {
      expect(enemy.title).toBeTruthy();
      expect(enemy.art).toBeTruthy();
    }
  });

  it("uses the imported Will-o-Wisp art and no placeholder art remains", () => {
    const willOWisp = enemyBestiary.find((enemy) => enemy.id === "will-o-wisp")!;
    const bandit = enemyBestiary.find((enemy) => enemy.id === "bandit")!;
    expect(willOWisp.art).toBeTruthy();
    expect(bandit.art).toBeTruthy();
    expect(willOWisp.art).not.toBe(bandit.art);
    expect(enemyBestiary.filter((enemy) => enemy.art === placeholderEnemy)).toHaveLength(0);
  });
});

describe("trinketLibrary data integrity", () => {
  it("all boon IDs are unique", () => {
    const ids = trinketLibrary.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each boon has a title and art", () => {
    for (const boon of trinketLibrary) {
      expect(boon.title).toBeTruthy();
      expect(boon.art).toBeTruthy();
    }
  });
});
