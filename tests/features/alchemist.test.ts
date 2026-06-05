import { describe, expect, it } from "vitest";
import { createMixedPotion, applyMixToDeck } from "@/features/alchemy/run-loop/potion-mixer";
import { ALCHEMIST_MIX_PRICE } from "@/lib/game-constants";
import type { BattleCard } from "@/lib/game-data/types";

function healthPotion(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "health-potion",
    title: "Health Potion",
    descriptionLines: ["Restore 8 Health", "Consume"],
    art: "health-potion-art",
    cost: 1,

    consume: true,
    effects: [{ kind: "heal", amount: 8 }],
    ...overrides,
  };
}

function manaPotion(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "mana-potion",
    title: "Mana Potion",
    descriptionLines: ["Restore 2 Mana", "Consume"],
    art: "mana-potion-art",
    cost: 1,

    consume: true,
    effects: [{ kind: "restore-mana", amount: 2 }],
    ...overrides,
  };
}

function panaceaPotionCard(): BattleCard {
  return {
    id: "panacea-potion",
    title: "Panacea Potion",
    descriptionLines: ["Remove 1 harmful status effect", "Consume"],
    art: "panacea-potion-art",
    cost: 1,

    consume: true,
    effects: [{ kind: "remove-harmful-status", amount: 1 }],
  };
}

describe("createMixedPotion", () => {
  describe("same card combination", () => {
    it("doubles heal effect amount for two Health Potions", () => {
      const mixed = createMixedPotion(healthPotion(), healthPotion());

      expect(mixed.effects).toHaveLength(1);
      expect(mixed.effects[0].kind).toBe("heal");
      expect((mixed.effects[0] as { kind: "heal"; amount: number }).amount).toBe(16);
    });

    it("doubles restore-mana effect for two Mana Potions", () => {
      const mixed = createMixedPotion(manaPotion(), manaPotion());

      expect(mixed.effects).toHaveLength(1);
      expect(mixed.effects[0].kind).toBe("restore-mana");
      expect((mixed.effects[0] as { kind: "restore-mana"; amount: number }).amount).toBe(4);
    });

    it("doubles numbers in descriptions", () => {
      const mixed = createMixedPotion(healthPotion(), healthPotion());

      expect(mixed.descriptionLines).toContain("Restore 16 Health");
    });

    it("doubles remove-harmful-status amount for two Panacea Potions", () => {
      const mixed = createMixedPotion(panaceaPotionCard(), panaceaPotionCard());

      expect(mixed.effects).toHaveLength(1);
      expect(mixed.effects[0].kind).toBe("remove-harmful-status");
      expect((mixed.effects[0] as { kind: "remove-harmful-status"; amount: number }).amount).toBe(2);
    });

    it("doubles numbers in remove-harmful-status description", () => {
      const mixed = createMixedPotion(panaceaPotionCard(), panaceaPotionCard());

      expect(mixed.descriptionLines).toContain("Remove 2 harmful status effect");
    });
  });

  describe("different card combination", () => {
    it("concatenates effects from both cards", () => {
      const mixed = createMixedPotion(healthPotion(), manaPotion());

      expect(mixed.effects).toHaveLength(2);
      expect(mixed.effects[0].kind).toBe("heal");
      expect(mixed.effects[1].kind).toBe("restore-mana");
    });

    it("preserves original amounts in effects", () => {
      const mixed = createMixedPotion(healthPotion(), manaPotion());

      expect((mixed.effects[0] as { kind: "heal"; amount: number }).amount).toBe(8);
      expect((mixed.effects[1] as { kind: "restore-mana"; amount: number }).amount).toBe(2);
    });

    it("combines both description lines", () => {
      const mixed = createMixedPotion(healthPotion(), manaPotion());

      expect(mixed.descriptionLines).toContain("Restore 8 Health");
      expect(mixed.descriptionLines).toContain("Restore 2 Mana");
    });

    it("deduplicates shared non-Consume descriptions", () => {
      const cardA = healthPotion({ descriptionLines: ["Shared line", "Consume"] });
      const cardB = manaPotion({ descriptionLines: ["Shared line", "Consume"] });

      const mixed = createMixedPotion(cardA, cardB);

      const sharedCount = mixed.descriptionLines.filter((l) => l === "Shared line").length;
      expect(sharedCount).toBe(1);
    });
  });

  describe("Consume handling", () => {
    it("has consume: true on the resulting card", () => {
      const mixed = createMixedPotion(healthPotion(), manaPotion());

      expect(mixed.consume).toBe(true);
    });

    it("has Consume exactly once in descriptionLines", () => {
      const mixed = createMixedPotion(healthPotion(), manaPotion());

      const consumeCount = mixed.descriptionLines.filter((l) => l === "Consume").length;
      expect(consumeCount).toBe(1);
    });

    it("places Consume as the last description line", () => {
      const mixed = createMixedPotion(healthPotion(), manaPotion());

      expect(mixed.descriptionLines[mixed.descriptionLines.length - 1]).toBe("Consume");
    });

    it("does not double Consume in same-card mix", () => {
      const mixed = createMixedPotion(healthPotion(), healthPotion());

      const consumeCount = mixed.descriptionLines.filter((l) => l === "Consume").length;
      expect(consumeCount).toBe(1);
    });
  });

  describe("cannot combine with mixed-potion", () => {
    it("throws when first card is mixed-potion", () => {
      const mixedPotion: BattleCard = {
        id: "mixed-potion",
        title: "Mixed Potion",
        descriptionLines: ["Test"],
        art: "",
        cost: 1,
    
        consume: true,
        effects: [],
      };

      expect(() => createMixedPotion(mixedPotion, healthPotion())).toThrow(
        "Cannot mix with an existing Mixed Potion"
      );
    });

    it("throws when second card is mixed-potion", () => {
      const mixedPotion: BattleCard = {
        id: "mixed-potion",
        title: "Mixed Potion",
        descriptionLines: ["Test"],
        art: "",
        cost: 1,
    
        consume: true,
        effects: [],
      };

      expect(() => createMixedPotion(healthPotion(), mixedPotion)).toThrow(
        "Cannot mix with an existing Mixed Potion"
      );
    });
  });

  describe("data types and shape", () => {
    it("has id starting with mixed-potion-", () => {
      const mixed = createMixedPotion(healthPotion(), manaPotion());

      expect(mixed.id).toMatch(/^mixed-potion-\d+$/);
    });

    it("has title 'Mixed Potion'", () => {
      const mixed = createMixedPotion(healthPotion(), manaPotion());

      expect(mixed.title).toBe("Mixed Potion");
    });

    it("has cost 1", () => {
      const mixed = createMixedPotion(healthPotion(), manaPotion());

      expect(mixed.cost).toBe(1);
    });

    it("sets art to panaceaPotion", () => {
      const mixed = createMixedPotion(healthPotion(), manaPotion());

      expect(mixed.art).toBeDefined();
      expect(typeof mixed.art).toBe("string");
    });
  });
});

describe("applyMixToDeck", () => {
  it("removes the two selected cards and adds the mixed potion", () => {
    const cardA = healthPotion({ id: "hp-1" });
    const cardB = manaPotion({ id: "mp-1" });
    const cardC = healthPotion({ id: "hp-2" });
    const deck = [cardA, cardB, cardC];
    const mixed = createMixedPotion(cardA, cardC);

    const newDeck = applyMixToDeck(deck, 0, 2, mixed);

    expect(newDeck).toHaveLength(2);
    expect(newDeck[0].id).toBe("mp-1");
    expect(newDeck[1].id).toBe(mixed.id);
  });

  it("handles unsorted indices correctly", () => {
    const deck = [healthPotion({ id: "a" }), manaPotion({ id: "b" }), healthPotion({ id: "c" })];
    const mixed = createMixedPotion(healthPotion(), manaPotion());

    const newDeck = applyMixToDeck(deck, 2, 0, mixed);

    expect(newDeck).toHaveLength(2);
    expect(newDeck[0].id).toBe("b");
    expect(newDeck[1].id).toBe(mixed.id);
  });

  it("appends the mixed potion at the end", () => {
    const deck = [
      healthPotion({ id: "a" }),
      manaPotion({ id: "b" }),
      healthPotion({ id: "c" }),
      manaPotion({ id: "d" }),
    ];
    const mixed = createMixedPotion(healthPotion(), manaPotion());

    const newDeck = applyMixToDeck(deck, 0, 1, mixed);

    expect(newDeck[newDeck.length - 1].id).toBe(mixed.id);
  });
});

describe("gold deduction", () => {
  it("costs 40 gold per mix", () => {
    expect(ALCHEMIST_MIX_PRICE).toBe(40);
  });
});
