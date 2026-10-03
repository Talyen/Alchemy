import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { createCampfirePotionOffers, strengthenPotion } from "@/lib/alchemist/brewing";
import { createTransmutationOffers } from "@/lib/alchemist/transmutation";
import { tryCreateMixedPotion } from "@/lib/alchemist";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { createSeededRng } from "@/lib/rng";
describe("brewing and transmutation content", () => {
  it("creates distinct fixed Potion offers with a recovery or defense option", () => {
    const offers = createCampfirePotionOffers(createSeededRng(23));
    expect(new Set(offers.map((card) => card.id)).size).toBe(3);
    expect(offers.some((card) => ["health-potion", "stoneskin-potion", "panacea-potion"].includes(card.id))).toBe(true);
    expect(offers).toEqual(createCampfirePotionOffers(createSeededRng(23)));
  });
  it("strengthens numerical effects once and preserves the result through save hydration", () => {
    const potion = strengthenPotion(cardById["health-potion"]!)!;
    expect(potion.descriptionLines).toEqual(["Restore 12 Health", "Consume"]);
    expect(potion.cost).toBe(cardById["health-potion"]!.cost);
    const restored = hydrateCard(BattleCardSchema.parse(potion));
    expect(restored.effects).toEqual(potion.effects);
    expect(restored.brewed).toBe(true);
    expect(strengthenPotion(restored)).toBeNull();
    expect(tryCreateMixedPotion(restored, cardById["mana-potion"])).toBeNull();
    expect(strengthenPotion(cardById["panacea-potion"]!)).toBeNull();
    expect(strengthenPotion(cardById["wishing-potion"]!)).toBeNull();
  });
  it("preserves nested chance probabilities and nonnumeric Acid effects", () => {
    const acid = strengthenPotion(cardById["acid-potion"]!)!;
    expect(acid.effects).toEqual([
      { kind: "remove-enemy-armor", halve: true },
      { kind: "damage", damageType: "poison", amount: 3 },
    ]);
    const luck = strengthenPotion(cardById["luck-potion"]!)!;
    expect(luck.effects[0]).toMatchObject({ kind: "chance", probability: 0.5 });
  });
  it("offers one explicit ordinary card role each with distinct identities", () => {
    const offers = createTransmutationOffers(createSeededRng(51));
    expect(offers.map((card) => card.transmutationRole)).toEqual(["attack", "defense", "utility"]);
    expect(new Set(offers.map((card) => card.id)).size).toBe(3);
  });
});
