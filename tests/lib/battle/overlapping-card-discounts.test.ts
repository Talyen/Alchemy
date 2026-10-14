import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("overlapping card discounts", () => {
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
});
