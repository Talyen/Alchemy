import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { resolvePlayerCrowdControlTriggers } from "@/lib/battle/status-cc";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import { applyWishEffect, chooseWishCard } from "@/lib/battle/wish";
import { cardById, computeTalentEffects, getTalentsForKeyword, keywordDefinitions } from "@/lib/game-data";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("player rule help matches consequential combat behavior", () => {
  it("explains why an injured hero does not Freeze or Stun at half current Health", () => {
    const state = regressionBattle({ playerHealth: 8, playerMaxHealth: 30, playerStatuses: { stun: 4, freeze: 4 } });
    const next = resolvePlayerCrowdControlTriggers(state, []);
    expect(next.playerCC).toMatchObject({ stunSkipTurns: 0, freezeSkipTurns: 0 });
    const stunned = resolvePlayerCrowdControlTriggers(
      { ...state, playerStatuses: { ...state.playerStatuses, stun: 15 } },
      [],
    );
    expect(stunned.playerCC.stunSkipTurns).toBe(1);
    for (const keyword of ["stun", "freeze"] as const) {
      expect(keywordDefinitions[keyword].description).toContain("hero's maximum Health");
      expect(keywordDefinitions[keyword].description).toContain("enemy's Health before the hit");
    }
  });

  it("explains that Forge is spent only by damage it boosts", () => {
    const state = regressionBattle({ playerStatuses: { forge: 3 }, enemyHealth: 100, enemyMaxHealth: 100 });
    const holy = applyCardEffects(state, cardById.tithe!, []);
    expect(holy.playerStatuses.forge).toBe(3);
    const physical = applyCardEffects(holy, cardById.slash!, []);
    expect(physical.playerStatuses.forge).toBe(2);
    expect(keywordDefinitions.forge.description).toContain("damage that uses Forge");
  });

  it("explains that Wish offers can expand and full-hand choices are kept", () => {
    const hand = Array.from({ length: MAX_HAND_SIZE }, (_, uid) => makeTestCard({ uid }));
    const state = regressionBattle({ hand, encounterBenefits: ["wishful"] });
    const wished = applyWishEffect(state, undefined, 1, []);
    expect(wished.wishOptions).toHaveLength(4);
    const choice = wished.wishOptions![0]!;
    const chosen = chooseWishCard(wished, choice.id);
    expect(chosen.hand).toHaveLength(MAX_HAND_SIZE);
    expect(chosen.pendingHandCards.map((card) => card.id)).toEqual([choice.id]);
    expect(keywordDefinitions.wish.description).toContain("normally three");
    expect(keywordDefinitions.wish.description).toContain("queued when your hand is full");
  });

  it("describes threshold talents as percentage points rather than a relative ten-percent reduction", () => {
    const talents = computeTalentEffects({ stun: ["stun-threshold"], freeze: ["freeze-threshold"] });
    const state = regressionBattle({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { stun: 40, freeze: 40 },
      talentEffects: talents,
    });
    expect(resolveStunTrigger(state, []).enemyCC.stunSkipTurns).toBe(1);
    expect(tryTriggerEnemyFreeze(state, state, []).enemyCC.freezeSkipTurns).toBe(1);
    for (const [keyword, id] of [
      ["stun", "stun-threshold"],
      ["freeze", "freeze-threshold"],
    ] as const) {
      expect(getTalentsForKeyword(keyword).find((talent) => talent.id === id)?.description).toContain(
        "10 percentage points",
      );
    }
  });
});
