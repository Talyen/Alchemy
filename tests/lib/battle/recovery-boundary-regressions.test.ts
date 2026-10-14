import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { computeBaseDamage } from "@/lib/battle/player-damage-base";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("recovery boundaries", () => {
  it("fatal Emergency Wish retaliation from a Bleed draw stops later Leech healing", () => {
    const card = makeTestCard({
      cost: 0,
      effects: [{ kind: "damage", damageType: "bleed", amount: 2, lifesteal: true }],
    });
    const state = regressionBattle({
      hand: [card],
      playerHealth: 1,
      deathsDoorUsed: true,
      enemyHealth: 40,
      enemyMaxHealth: 40,
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      talentEffects: { drawOnBleedDamageChance: 100, burnOnWish: 1 },
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerHealth).toBe(0);
  });
  it("a zero-percent Gold attack cannot fall back to its authored base damage", () => {
    const state = regressionBattle({ gold: 100 });
    expect(computeBaseDamage(state, { kind: "damage", damageType: "holy", amount: 9, equalToGoldPercent: 0 })).toBe(0);
  });
});
