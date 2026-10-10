import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { getEnemyTraitDamageMultiplier } from "@/lib/battle/status-helpers";
import { buildWishOptions } from "@/lib/battle/wish";
import type { CombatTextEvent } from "@/lib/battle/types";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { createSeededRng } from "@/lib/rng";
import { regressionBattle } from "../../fixtures/battle";

describe("queued rewards and hit ordering", () => {
  it("combines Cinder Ward with a native Burn vulnerability", () => {
    const state = regressionBattle({
      currentEnemy: {
        traits: [
          { id: "glacial-body", title: "Glacial Body", description: "" },
          ENCOUNTER_TRAITS["burn-resistance"].enemyTrait,
        ],
      },
    });
    expect(getEnemyTraitDamageMultiplier(state, "burn")).toBeCloseTo(0.65);
  });

  it.each([false, true])("Twincasting draws once after an automatic card play (repeat: %s)", (repeat) => {
    const burn = cardById.kindling!;
    const freeze = cardById["ray-of-frost"]!;
    const state = regressionBattle({
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      deck: [burn, freeze],
      hand: repeat ? Array.from({ length: 7 }, () => cardById.slash!) : [],
      gearEffects: { dodgeDrawAndPlay: 1, elementalTwinCasting: 1 },
      talentEffects: { burnCardPlayTwiceChance: repeat ? 100 : 0 },
      rng: () => 0,
    });
    const after = applyEnemyAbility(state, cardById.slash!, []);
    expect(after.discard.filter((card) => card.id === burn.id)).toHaveLength(1);
    expect((repeat ? after.pendingHandCards : after.hand).map((card) => card.id)).toEqual([freeze.id]);
    if (repeat) expect(after.hand).toEqual(state.hand);
    expect(after.deck).toHaveLength(0);
  });

  it.each([0, 1])("preserves hit-earned Forge alongside the original %i Forge", (forge) => {
    const card = { ...cardById.slash!, uid: 1 };
    const state = regressionBattle({
      hand: [card],
      mana: 2,
      playerStatuses: { forge },
      gearEffects: { goldGrantsForgeAndHoly: 1, forgeEveryThreeTurns: 1 },
      talentEffects: { armorOnPhysicalDamageChance: 100, goldOnArmorGainChance: 100 },
    });
    const after = playBattleCardResolved(state, card.id, 0).state;
    expect(after.gold).toBeGreaterThan(0);
    expect(after.playerStatuses.forge).toBe(forge);
  });

  it("counts queued Companion cards when weighting Wish offers", () => {
    const companion = cardById["wolf-companion"]!;
    const cards = Array.from({ length: 7 }, () => cardById.slash!);
    const base = regressionBattle({ hand: cards });
    const fromDeck = buildWishOptions({ ...base, deck: [companion], rng: createSeededRng(42) }, undefined);
    const fromQueue = buildWishOptions({ ...base, pendingHandCards: [companion], rng: createSeededRng(42) }, undefined);
    expect(fromQueue.map((card) => card.id)).toEqual(fromDeck.map((card) => card.id));
  });

  it("regrows Wildwood Thorns during the next enemy phase", () => {
    const card = { ...cardById.slash!, uid: 1 };
    const state = regressionBattle({
      hand: [card],
      mana: 2,
      currentEnemy: { traits: [ENCOUNTER_TRAITS.thorns.enemyTrait] },
      enemyStatuses: { thorns: 1 },
      enemyCC: { stunSkipTurns: 1 },
      flags: { legacyEnemyThornsReady: true },
    });
    const first = playBattleCardResolved(state, card.id, 0).state;
    const next = endPlayerTurn(first).state;
    expect(next.flags.legacyEnemyThornsReady).toBe(true);
    expect(next.enemyStatuses.thorns).toBe(1);
    const second = playBattleCardResolved(next, next.hand[0]!.id, 0).state;
    expect(second.playerHealth).toBe(next.playerHealth - 1);
  });

  it("reports Clean Getaway's partial Burn and Poison removal", () => {
    const texts: CombatTextEvent[] = [];
    const state = regressionBattle({
      playerStatuses: { burn: 3, poison: 2, bleed: 1 },
      talentEffects: computeTalentEffects({ dodge: ["dodge-clean-getaway"] }),
    });
    const after = applyDodgeTalentStatuses(state, texts);
    expect(after.playerStatuses).toMatchObject({ burn: 2, poison: 1, bleed: 0 });
    expect(texts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "player", kind: "damage", stat: "burn", amount: 1, impact: false }),
        expect.objectContaining({ target: "player", kind: "damage", stat: "poison", amount: 1, impact: false }),
        expect.objectContaining({ target: "player", kind: "notice", stat: "bleed", signal: "cleanse" }),
      ]),
    );
  });

  it("Bleed Leech excludes Profane Blood damage caused by Cutpurse healing", () => {
    const state = regressionBattle({
      playerHealth: 10,
      playerMaxHealth: 30,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 8 },
      pendingBleedLeechHealing: 8,
      currentEnemy: {
        traits: [
          { id: "blood-countess", title: "Profane Blood", description: "" },
          ENCOUNTER_TRAITS["crimson-ward"].enemyTrait,
        ],
      },
      trinketEffects: { cutpurseGoldOnBleed: 1 },
      gearEffects: { healOnCombatGoldGain: 1 },
    });
    const after = tickEnemyStatuses(state, []);
    expect(after.playerHealth).toBe(13);
    expect(after.enemyHealth).toBe(94);
    expect(after.pendingBleedLeechHealing).toBe(0);
  });

  it("Hunter's Bond opens an Emergency Wish when its draw has no cards left", () => {
    const card = { ...cardById["wolf-companion"]!, uid: 1 };
    const state = regressionBattle({
      hand: [card],
      mana: 2,
      talentEffects: computeTalentEffects({ companion: ["companion-hunters-bond"] }),
    });
    const after = playBattleCardResolved(state, card.id, 0).state;
    expect(after.activeCompanion?.id).toBe("wolf");
    expect(after.hand).toHaveLength(0);
    expect(after.wishOptions).toHaveLength(3);
  });
});
