import { makeDamageCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("overlapping card discounts", () => {
  it("preserves The Knight's Answer when Wildheart already makes a Physical Nature card free", () => {
    const nature = makeDamageCard("physical", 1, { id: "physical-nature", tags: ["nature"] });
    const physical = makeDamageCard("physical", 1, { id: "physical" });
    const state = patchBattleState({
      mana: 0,
      hand: [nature, physical],
      gearEffects: { dodgeReadiesNatureCrit: 1, blockReadiesFreePhysical: 1 },
      uniqueGear: { wildheartReady: true, knightsAnswerReady: true },
      rng: () => 0.99,
    });
    const first = playBattleCardResolved(state, nature.id, 0).state;
    expect(first.uniqueGear.wildheartReady).toBe(false);
    expect(first.uniqueGear.knightsAnswerReady).toBe(true);
    const second = playBattleCardResolved(first, physical.id, 0).state;
    expect(second.cardsPlayedThisTurn).toBe(2);
    expect(second.hand).toHaveLength(0);
    expect(second.mana).toBe(0);
    expect(second.uniqueGear.knightsAnswerReady).toBe(false);
  });

  it("preserves a partial armed discount when a Holy allowance makes the card free", () => {
    const card = makeTestCard({ cost: 3, tags: ["holy"], effects: [] });
    const state = patchBattleState({
      mana: 0,
      hand: [card],
      flags: { nextCardCostReduction: 1, nextHolyCardFree: true },
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.hand).toHaveLength(0);
    expect(result.mana).toBe(0);
    expect(result.flags.nextHolyCardFree).toBe(false);
    expect(result.flags.nextCardCostReduction).toBe(1);
  });

  it("preserves an armed discount when a 1-cost card is made free by a Holy allowance", () => {
    const card = makeTestCard({ cost: 1, tags: ["holy"], effects: [] });
    const state = patchBattleState({
      mana: 0,
      hand: [card],
      flags: { nextCardCostReduction: 1, nextHolyCardFree: true },
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.hand).toHaveLength(0);
    expect(result.mana).toBe(0);
    expect(result.flags.nextHolyCardFree).toBe(false);
    expect(result.flags.nextCardCostReduction).toBe(1);
  });
});
