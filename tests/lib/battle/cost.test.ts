import { describe, expect, it } from "vitest";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import type { CombatFlags } from "@/lib/battle/types";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import { patchBattleState, makeTestCard } from "../../fixtures/battle";

const firstFreeCases: Array<{
  talent: keyof TalentEffectManifest;
  flag: keyof CombatFlags;
  card: Partial<BattleCard>;
}> = [
  {
    talent: "firstBurnCardFree",
    flag: "firstBurnCardFreeUsed",
    card: { effects: [{ kind: "damage", damageType: "burn", amount: 1 }] },
  },
  {
    talent: "firstHolyCardFree",
    flag: "firstHolyCardFreeUsed",
    card: { effects: [{ kind: "damage", damageType: "holy", amount: 1 }] },
  },
  {
    talent: "firstPoisonCardFree",
    flag: "firstPoisonCardFreeUsed",
    card: { effects: [{ kind: "damage", damageType: "poison", amount: 1 }] },
  },
  {
    talent: "firstBleedCardFree",
    flag: "firstBleedCardFreeUsed",
    card: { effects: [{ kind: "damage", damageType: "bleed", amount: 1 }] },
  },
  { talent: "firstConsumeCardFree", flag: "firstConsumeCardFreeUsed", card: { consume: true, effects: [] } },
  {
    talent: "firstCompanionCardFree",
    flag: "firstCompanionCardFreeUsed",
    card: { effects: [{ kind: "summon-companion", companionId: "wolf" }] },
  },
  { talent: "firstArcheryCardFree", flag: "firstArcheryCardFreeUsed", card: { tags: ["archery"], effects: [] } },
];

describe("first-card-free talents", () => {
  it.each(firstFreeCases)("$talent pays for only its first matching card", ({ talent, flag, card }) => {
    const first = makeTestCard({ ...card, id: "first", cost: 2, uid: 1 });
    const second = makeTestCard({ ...card, id: "second", cost: 2, uid: 2 });
    const state = patchBattleState({
      mana: 0,
      hand: [first, second],
      talentEffects: { [talent]: true },
      rng: () => 0.99,
    });
    const unrelated = makeTestCard({ cost: 2, effects: [{ kind: "heal", amount: 1 }] });
    expect(computeEffectiveCost(state, unrelated).effectiveCost).toBe(2);
    expect(canPlayCard(state, first, 0)).toBe(true);
    const result = playBattleCardResolved(state, first.id, 0).state;
    expect(result.flags[flag]).toBe(true);
    expect(result.mana).toBe(0);
    expect(computeEffectiveCost(result, second).effectiveCost).toBe(2);
    expect(canPlayCard(result, second, 0)).toBe(false);
    expect(playBattleCardResolved(result, second.id, 0).state).toBe(result);
    expect(state.flags[flag]).toBe(false);
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
