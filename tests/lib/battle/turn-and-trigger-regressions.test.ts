import { describe, expect, it } from "vitest";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { applyWishEffect } from "@/lib/battle/wish";
import { companionLibrary, cardById } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("turn and trigger regressions", () => {
  it("Lastlight checks Mana before Runic Quill can grant an Emergency Wish refund", () => {
    const card = makeTestCard({ consume: true });
    const state = regressionBattle({
      mana: 0,
      gearEffects: { holyOnConsumeWithoutMana: 2 },
      trinketEffects: { runicQuillDrawOnConsume: 1 },
      talentEffects: { manaOnWish: 1 },
    });
    const next = handlePostPlayCardDestination(state, card);
    expect(next.mana).toBe(1);
    expect(next.wishOptions).not.toBeNull();
    expect(next.enemyHealth).toBe(state.enemyHealth - 2);
  });

  it("fatal Emergency Wish retaliation stops later Thermal Vent rewards", () => {
    const card = cardById["fire-arrow"]!;
    const state = regressionBattle({
      hand: [card],
      playerHealth: 1,
      deathsDoorUsed: true,
      enemyCC: { stunSkipTurns: 1 },
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      talentEffects: { drawOnArcheryVsStunned: 1, burnOnWish: 1, forgeOnBurnCard: 3, forgeOnBurnCardChance: 10 },
      rng: () => 0,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerHealth).toBe(0);
    expect(next.playerStatuses.forge).toBe(0);
    expect(next.discard).toContainEqual(card);
  });

  it("Wishfire adds Burn buildup and applies Melting Point to its Burn hit", () => {
    const state = regressionBattle({
      enemyStatuses: { burn: 1 },
      enemyMitigation: { armor: 10 },
      gearEffects: { burnOnWish: 2 },
      talentEffects: { burnRemovesEnemyArmor: true },
    });
    const next = applyWishEffect(state, undefined, 1, []);
    expect(next.enemyHealth).toBe(state.enemyHealth - 2);
    expect(next.enemyStatuses.burn).toBe(3);
    expect(next.enemyMitigation.armor).toBe(7);
  });

  it("Kinbound checks low Health before Bone Charm's kill healing", () => {
    const state = regressionBattle({
      activeCompanion: companionLibrary.skeleton,
      playerHealth: 14,
      playerMaxHealth: 30,
      enemyHealth: 1,
      gearEffects: { healOnCompanionAttack: 2 },
      trinketEffects: { boneCharmHealOnKill: 3 },
    });
    const next = processCompanionTurnStart(state, []);
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(19);
  });

  it("Rootmender grants Leech for Thunderstone damage against a Poisoned enemy", () => {
    const state = regressionBattle({
      playerHealth: 10,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { stun: 30, poison: 1 },
      trinketEffects: { thunderstoneDamageOnStun: 6 },
      gearEffects: { natureLeechVsPoisoned: 1 },
    });
    const next = resolveStunTrigger(state, []);
    expect(next.enemyHealth).toBe(24);
    expect(next.playerHealth).toBe(13);
  });
});
