import type { CombatTextEvent } from "@/lib/battle";
import { describe, expect, it } from "vitest";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { augmentDefinitions } from "@/features/alchemy/shared/augment-definitions";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { resolvePlayerCrowdControlTriggers } from "@/lib/battle/status-cc";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import { applyWishEffect, chooseWishCard } from "@/lib/battle/wish";
import { cardById, computeTalentEffects, getTalentsForKeyword, keywordDefinitions } from "@/lib/game-data";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("player rule help matches consequential combat behavior", () => {
  it("describes a prepared critical strike as one hit rather than a whole multi-hit card", () => {
    const state = regressionBattle({ enemyHealth: 100, enemyMaxHealth: 100, flags: { nextHitCrit: true } });
    const texts: CombatTextEvent[] = [];
    const hit = applyCardEffects(state, cardById["ray-of-frost"]!, texts, {
      origin: "played-card",
      manaAtStart: state.mana,
    });
    expect(hit.enemyHealth).toBe(97);
    expect(texts.filter((event) => event.target === "enemy" && event.kind === "damage" && event.critical)).toHaveLength(
      1,
    );
    expect(augmentDefinitions.nextHitCrit.description).toContain("next card hit");
  });

  it("describes prepared Leech as one hit rather than a whole multi-hit card", () => {
    const state = regressionBattle({
      playerHealth: 10,
      playerMaxHealth: 30,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      flags: { nextHitLeech: true },
    });
    const hit = applyCardEffects(state, cardById["ray-of-frost"]!, [], {
      origin: "played-card",
      manaAtStart: state.mana,
    });
    expect(hit.enemyHealth).toBe(98);
    expect(hit.playerHealth).toBe(11);
    expect(hit.flags.nextHitLeech).toBe(false);
    expect(augmentDefinitions.nextHitLeech.description).toContain("next card hit");
  });

  it("describes Parting Cut as copying only the next Physical hit", () => {
    const source = cardById["ray-of-frost"]!;
    const card = getTransmutationVariants(source, "physical", [source])[0]!.result;
    const state = regressionBattle({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      flags: { nextPhysicalDealsBleed: true },
      talentEffects: computeTalentEffects({ bleed: ["bleed-physical-bonus"] }),
    });
    const hit = applyCardEffects(state, card, [], {
      origin: "played-card",
      manaAtStart: state.mana,
    });
    expect(hit.enemyHealth).toBe(97);
    expect(hit.enemyStatuses.bleed).toBe(1);
    expect(augmentDefinitions.nextPhysicalDealsBleed.description).toContain("next Physical hit");
    expect(getTalentsForKeyword("bleed").find((talent) => talent.id === "bleed-physical-bonus")?.description).toContain(
      "next Physical hit",
    );
  });

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

  it("explains that Forge persists after damage it boosts", () => {
    const state = regressionBattle({ playerStatuses: { forge: 3 }, enemyHealth: 100, enemyMaxHealth: 100 });
    const holy = applyCardEffects(state, cardById.tithe!, []);
    expect(holy.playerStatuses.forge).toBe(3);
    const physical = applyCardEffects(holy, cardById.slash!, []);
    expect(physical.playerStatuses.forge).toBe(3);
    expect(keywordDefinitions.forge.description).toContain("for the rest of combat");
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
