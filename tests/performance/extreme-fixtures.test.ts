import { expect, it } from "vitest";
import { extremeArmoryInventory, largeRunDeck } from "../../performance/scenario-data";
import { gearDefinitions } from "../../src/lib/gear/definitions";
import { buildEligibleAffixPool } from "../../src/lib/gear/affix-pool";
import { gearAffixCatalog } from "../../src/lib/gear/affix-catalog";
import { GEAR_AFFIX_COUNT } from "../../src/lib/game-constants";
import { hydrateCard } from "../../src/lib/game-data/cards/hydrate-card";
import { cardById } from "../../src/lib/game-data/cards/library/cards";

it("keeps extreme fixtures within authored item and card rules as catalogs change", () => {
  const inventory = extremeArmoryInventory();
  expect(new Set(inventory.map((item) => item.instanceId)).size).toBe(200);
  const variants = new Map(inventory.map((item) => [JSON.stringify([item.definitionId, item.affixes]), item]));
  for (const item of variants.values()) {
    const definition = gearDefinitions[item.definitionId]!;
    const count = GEAR_AFFIX_COUNT[definition.rarity];
    expect(item.affixes.length).toBeGreaterThanOrEqual(count.min);
    expect(item.affixes.length).toBeLessThanOrEqual(count.max);
    const eligible = new Set(buildEligibleAffixPool(definition).map((affix) => affix.id));
    expect(new Set(item.affixes.map((affix) => affix.id)).size).toBe(item.affixes.length);
    for (const affix of item.affixes) {
      expect(eligible.has(affix.id)).toBe(true);
      const range = gearAffixCatalog[affix.id].roll[definition.rarity];
      expect(affix.value).toBeGreaterThanOrEqual(range.min);
      expect(affix.value).toBeLessThanOrEqual(range.max);
    }
  }
  const deck = largeRunDeck();
  expect(new Set(deck.map((card) => card.uid)).size).toBe(60);
  for (const saved of new Map(deck.map((card) => [card.id, card])).values()) {
    const hydrated = hydrateCard(saved);
    expect(hydrated.effects).toEqual(cardById[saved.id]!.effects);
    expect(hydrated.cost).toBe(cardById[saved.id]!.cost);
    expect(hydrated.art).toBe(cardById[saved.id]!.art);
  }
});
