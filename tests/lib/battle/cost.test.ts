import { describe, expect, it } from "vitest";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { patchBattleState, makeTestCard } from "../../fixtures/battle";

describe("first-card-free talents", () => {
  it("Flashpoint pays for only its first Burn card", () => {
    const card = { effects: [{ kind: "damage" as const, damageType: "burn" as const, amount: 1 }] };
    const first = makeTestCard({ ...card, id: "first", cost: 2, uid: 1 });
    const second = makeTestCard({ ...card, id: "second", cost: 2, uid: 2 });
    const state = patchBattleState({
      mana: 0,
      hand: [first, second],
      talentEffects: { firstBurnCardFree: true },
      rng: () => 0.99,
    });
    const unrelated = makeTestCard({ cost: 2, effects: [{ kind: "heal", amount: 1 }] });
    expect(computeEffectiveCost(state, unrelated).effectiveCost).toBe(2);
    expect(canPlayCard(state, first, 0)).toBe(true);
    const result = playBattleCardResolved(state, first.id, 0).state;
    expect(result.flags.firstBurnCardFreeUsed).toBe(true);
    expect(result.mana).toBe(0);
    expect(computeEffectiveCost(result, second).effectiveCost).toBe(2);
    expect(canPlayCard(result, second, 0)).toBe(false);
    expect(playBattleCardResolved(result, second.id, 0).state).toBe(result);
    expect(state.flags.firstBurnCardFreeUsed).toBe(false);
  });

  it("spends armed Holy, Archery, then Nature opportunities one at a time", () => {
    const card = makeTestCard({ cost: 2, effects: [], tags: ["holy", "archery", "nature"] });
    let state = patchBattleState({
      flags: { nextHolyCardFree: true, nextArcheryCardFree: true, nextNatureCardFree: true },
    });
    for (const flag of ["nextHolyCardFree", "nextArcheryCardFree", "nextNatureCardFree"] as const) {
      const result = computeEffectiveCost(state, card);
      expect(result.effectiveCost).toBe(0);
      expect(result.disarmedFlags).toEqual(new Set([flag]));
      state = { ...state, flags: { ...state.flags, [flag]: false } };
    }
    expect(computeEffectiveCost(state, card).effectiveCost).toBe(2);
  });
});
