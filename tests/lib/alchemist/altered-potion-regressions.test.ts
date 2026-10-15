import { describe, expect, it } from "vitest";
import { createMixedPotion, doublePotionPotency } from "@/lib/alchemist";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { makeTestCard } from "../../fixtures/cards";
import { applyCardEffects } from "@/lib/battle";
import { makeState } from "../../fixtures/battle";
import { cardById } from "@/lib/game-data";

describe("altered Potion regressions", () => {
  it("does not increase ingredient Health costs while mixing", () => {
    const ingredient = makeTestCard({
      id: "health-potion",
      effects: [
        { kind: "lose-health", amount: 2 },
        { kind: "heal", amount: 8 },
      ],
    });
    const mixed = createMixedPotion(ingredient, cardById["mana-potion"]!);
    expect(mixed.effects[0]).toEqual({ kind: "lose-health", amount: 2 });
    expect(mixed.effects[1]).toEqual({ kind: "heal", amount: 8 });
    expect(createMixedPotion(ingredient, ingredient).effects).toEqual([
      { kind: "lose-health", amount: 2 },
      { kind: "heal", amount: 8 },
      { kind: "lose-health", amount: 2 },
      { kind: "heal", amount: 8 },
    ]);
  });
  it("preserves extra-turn durations when mixing or doubling", () => {
    const ingredient = makeTestCard({
      id: "health-potion",
      effects: [{ kind: "player-status", status: "haste", amount: 1 }],
    });
    expect(createMixedPotion(ingredient, cardById["mana-potion"]!).effects[0]).toEqual(ingredient.effects[0]);
    expect(doublePotionPotency(ingredient).effects[0]).toEqual(ingredient.effects[0]);
  });
  it("distills the Companion action added to a Potion by Transmutation", () => {
    const source = getTransmutationVariants(cardById["health-potion"]!, "companion", [cardById["wolf-companion"]!])[0]!
      .result;
    expect(strengthenPotion(source)!.effects.at(-1)).toEqual({ kind: "companion-action", amount: 2 });
  });
  it("applies consumed Potion potency to Companion action counts", () => {
    const potion = makeTestCard({
      id: "health-potion",
      consume: true,
      effects: [{ kind: "companion-action", amount: 5 }],
    });
    const summon = applyCardEffects(makeState(), cardById["mana-moth-companion"]!, []);
    const state = { ...summon, mana: 0, maxMana: 20, talentEffects: { ...summon.talentEffects, potionPotency: 1.2 } };
    expect(applyCardEffects(state, potion, []).mana).toBe(6);
  });
});
