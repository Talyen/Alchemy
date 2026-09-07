import { describe, expect, it, vi } from "vitest";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { computeCardPayment } from "@/lib/battle/card-cost-rules";
import { patchBattleState, makeTestCard } from "../../fixtures/battle";

describe("card payment", () => {
  it.each([
    { cost: 0, mana: 0, block: 0, blockCost: 0, affordable: true },
    { cost: 3, mana: 3, block: 6, blockCost: 0, affordable: true },
    { cost: 3, mana: 1, block: 6, blockCost: 6, affordable: true },
    { cost: 3, mana: 1, block: 5, blockCost: 6, affordable: false },
  ])("pays cost $cost with $mana Mana and $block Block", ({ cost, mana, block, blockCost, affordable }) => {
    const rng = vi.fn(() => 0.99);
    const card = makeTestCard({ cost, tags: ["freeze"], effects: [] });
    const state = patchBattleState({
      mana,
      hand: [card],
      playerStatuses: { block },
      gearEffects: { blockPaysFreezeMana: 1 },
      rng,
    });
    const before = structuredClone({ ...state, rng: undefined });
    expect(computeCardPayment(state, card)).toMatchObject({ effectiveCost: cost, blockCost, affordable });
    expect(canPlayCard(state, card, 0)).toBe(affordable);
    expect(canPlayCard(state, card, 0)).toBe(affordable);
    expect({ ...state, rng: undefined }).toEqual(before);
    const result = playBattleCardResolved(state, card.id, 0);
    if (affordable) {
      expect(result.state.mana).toBe(Math.max(0, mana - cost));
      expect(result.state.playerStatuses.block).toBe(block - blockCost);
    } else {
      expect(result.state).toBe(state);
      expect(result.combatTexts).toEqual([]);
    }
    expect({ ...state, rng: undefined }).toEqual(before);
    expect(rng).not.toHaveBeenCalled();
  });

  it("preserves overlapping talent, armed, gear, and encounter discount priorities", () => {
    const card = makeTestCard({
      cost: 3,
      tags: ["archery", "holy"],
      effects: [{ kind: "damage", damageType: "holy", amount: 1 }],
    });
    const state = patchBattleState({
      mana: 0,
      hand: [card],
      talentEffects: { firstHolyCardFree: true, firstArcheryCardFree: true },
      flags: { nextArcheryCardFree: true },
      gearEffects: { firstElementalCardsFree: 1 },
      encounterBenefits: ["quickdraw"],
      rng: () => 0.99,
    });
    const payment = computeCardPayment(state, card);
    expect(payment.effectiveCost).toBe(0);
    expect(payment.consumedFlags).toEqual(new Set(["firstHolyCardFreeUsed", "encounterArcheryUsed"]));
    expect(payment.disarmedFlags.size).toBe(0);
    expect(canPlayCard(state, card, 0)).toBe(true);
    expect(canPlayCard(state, card, 0)).toBe(true);
    expect(state.flags.firstHolyCardFreeUsed).toBe(false);
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.flags).toMatchObject({
      firstHolyCardFreeUsed: true,
      firstArcheryCardFreeUsed: false,
      nextArcheryCardFree: true,
      encounterArcheryUsed: true,
    });
    expect(result.uniqueGear.freeHolyUsed).toBe(true);
    expect(result.mana).toBe(0);
  });

  it("does not reuse a preview after resources change", () => {
    const card = makeTestCard({ cost: 2, effects: [] });
    const state = patchBattleState({ mana: 2, hand: [card] });
    expect(canPlayCard(state, card, 0)).toBe(true);
    const depleted = { ...state, mana: 1 };
    expect(playBattleCardResolved(depleted, card.id, 0)).toEqual({ state: depleted, combatTexts: [] });
  });

  it("rejects controlled plays without spending free-card opportunities or RNG", () => {
    const rng = vi.fn(() => 0.99);
    const card = makeTestCard({ cost: 2, tags: ["archery"], effects: [] });
    const state = patchBattleState({
      hand: [card],
      flags: { nextArcheryCardFree: true },
      encounterBenefits: ["quickdraw"],
      playerCC: { stunSkipTurns: 1 },
      rng,
    });
    expect(canPlayCard(state, card, 0)).toBe(false);
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state).toBe(state);
    expect(result.combatTexts).toEqual([]);
    expect(state.flags.nextArcheryCardFree).toBe(true);
    expect(state.flags.encounterArcheryUsed).toBe(false);
    expect(rng).not.toHaveBeenCalled();
  });
});
