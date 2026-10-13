import { describe, expect, it, vi } from "vitest";
import { resolveCardEffectChain } from "@/lib/battle/card-play-effects";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { computeTalentEffects } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("automatic and lethal hit regressions", () => {
  it("Dance of Blades does not reuse Follow-through from the previous manual card", () => {
    const arrow = makeTestCard({
      tags: ["archery"],
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: computeTalentEffects({ archery: ["archery-hail"] }),
      flags: { archeryCardsPlayedThisTurn: 2, archerySecondCardActive: true },
      rng: () => 0.99,
    });
    const automatic = resolveCardEffectChain(state, arrow, []).state;
    expect(automatic.enemyHealth).toBe(96);
    expect(automatic.flags.archeryCardsPlayedThisTurn).toBe(2);
    const next = playBattleCardResolved({ ...automatic, hand: [arrow] }, arrow.id, 0).state;
    expect(next.enemyHealth).toBe(92);
    expect(next.flags.archeryCardsPlayedThisTurn).toBe(3);
  });

  it.each([
    ["poison", "poison", "poison-stun-chance"],
    ["nature", "nature", "nature-entangle"],
    ["burn", "burn", "burn-dmg-3"],
  ] as const)("a lethal %s hit does not roll Stun against the defeated enemy", (damageType, tree, talentId) => {
    const card = makeTestCard({ effects: [{ kind: "damage", damageType, amount: 4 }] });
    const talents = computeTalentEffects({ [tree]: [talentId] });
    const rng = vi.fn(() => 0.99);
    const state = patchBattleState({
      enemyHealth: 1,
      enemyMaxHealth: 100,
      hand: [card],
      talentEffects: talents,
      rng,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.enemyHealth).toBe(0);
    // Dodge and Critical remain ordinary attack draws. A dead target cannot
    // consume the next persisted world roll for a Stun that cannot resolve.
    expect(rng).toHaveBeenCalledTimes(2);
    rng.mockClear();
    const surviving = playBattleCardResolved({ ...state, enemyHealth: 100 }, card.id, 0).state;
    expect(surviving.enemyHealth).toBe(96);
    expect(rng).toHaveBeenCalledTimes(3);
  });
});
