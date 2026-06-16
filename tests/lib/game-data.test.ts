import { describe, expect, it } from "vitest";
import {
  cardLibrary,
  characters,
  companionLibrary,
  enemyBestiary,
  getOfferableCardPool,
  trinketLibrary,
} from "@/lib/game-data";
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

  it("includes recently added cards without separate pool registration", () => {
    const poolIds = new Set(getOfferableCardPool().map((card) => card.id));
    for (const id of [
      "wishing-well",
      "molten-bulwark",
      "glacial-ward",
      "spiked-shield",
      "golden-plate",
      "crystal-bulwark",
      "hemorrhage",
      "bounty-shot",
      "sap-arrow",
      "gamblers-shot",
      "phoenix-feather",
    ]) {
      expect(poolIds.has(id)).toBe(true);
    }
  });
});

describe("characters data integrity", () => {
  it("each character has a valid starting deck referencing cardLibrary IDs", () => {
    const cardIds = new Set(cardLibrary.map((c) => c.id));
    for (const char of Object.values(characters)) {
      for (const card of char.startingDeck) {
        expect(cardIds.has(card.id)).toBe(true);
      }
    }
  });

  it("each character has at least one keyword (except wildcard)", () => {
    for (const char of Object.values(characters)) {
      if (char.id === "wildcard") {
        expect(char.keywords.length).toBe(0);
      } else {
        expect(char.keywords.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("all characters have unique IDs", () => {
    const ids = Object.values(characters).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("companionLibrary data integrity", () => {
  it("each companion has at least one turnStartEffect", () => {
    for (const companion of Object.values(companionLibrary)) {
      expect(companion.turnStartEffects.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("each companion has a title and art", () => {
    for (const companion of Object.values(companionLibrary)) {
      expect(companion.title).toBeTruthy();
      expect(companion.art).toBeTruthy();
    }
  });
});

describe("enemyBestiary data integrity", () => {
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
