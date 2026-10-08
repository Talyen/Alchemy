import { describe, expect, it } from "vitest";
import { cardById, getEnemyAbilityCard } from "@/lib/game-data";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyWishEffect } from "@/lib/battle/wish";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("combat reward boundaries", () => {
  it("Vital Wish cannot cancel Desperate Wish earned below half Health", () => {
    const state = patchBattleState({
      playerHealth: 19,
      playerMaxHealth: 40,
      talentEffects: { healthOnWish: 1, wishBlockBelowHealthPct: 50, wishBlockAmount: 2 },
    });
    const result = applyWishEffect(state, cardById.wish!, 1, []);
    expect(result.playerHealth).toBe(20);
    expect(result.playerStatuses.block).toBe(2);
  });

  it("Thorns retaliation preserves the next card's critical hit", () => {
    const state = patchBattleState({
      playerStatuses: { armor: 100, thorns: 3 },
      flags: { nextHitCrit: true },
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(state, getEnemyAbilityCard("slash"), []);
    expect(result.playerStatuses.thorns).toBe(0);
    expect(result.enemyHealth).toBe(state.enemyHealth - 3);
    expect(result.flags.nextHitCrit).toBe(true);
  });

  it("a fatal Wish retaliation stops rewards from subsequent Wishes", () => {
    const state = patchBattleState({
      playerHealth: 1,
      playerMaxHealth: 40,
      deathsDoorUsed: true,
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      talentEffects: { burnOnWish: 1, goldOnWish: 1 },
      rng: () => 0.99,
    });
    const result = applyCardEffects(state, makeTestCard({ effects: [{ kind: "wish", amount: 2 }] }), []);
    expect(result.playerHealth).toBe(0);
    expect(result.gold).toBe(state.gold + 1);
    expect(result.enemyHealth).toBe(state.enemyHealth - 1);
    expect(result.flags.pendingCinderSkinReaction).toBe(false);
  });
});
