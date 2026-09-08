import { describe, expect, it } from "vitest";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById } from "@/lib/game-data/cards/library/cards";
import { patchBattleState } from "../../fixtures/battle";

describe("defense and resource regressions", () => {
  it.each(["poison", "bleed"] as const)("applies matching resistance to %s ticks", (status) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { [status]: 10 },
      gearEffects: { resistPoison: 50, resistBleed: 50 },
    });
    const result = tickPlayerStatuses(state, []);
    expect(result.playerHealth).toBe(25);
    expect(state.playerHealth).toBe(30);
  });

  it("applies Poison damage reduction to Poison ticks", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { poison: 5 },
      talentEffects: { poisonDamageReduction: 2 },
    });
    expect(tickPlayerStatuses(state, []).playerHealth).toBe(27);
  });

  it.each(["burn", "poison", "bleed", "stun", "freeze"] as const)(
    "uses mitigated damage for enemy %s buildup and Leech",
    (damageType) => {
      const state = patchBattleState({
        playerHealth: 30,
        enemyHealth: 10,
        enemyMaxHealth: 30,
        talentEffects: { damageReduction: 4 },
      });
      const result = processEnemyDamageEffect(state, { kind: "damage", damageType, amount: 6, lifesteal: true }, []);
      expect(result.playerHealth).toBe(28);
      expect(result.playerStatuses[damageType]).toBe(2);
      expect(result.enemyHealth).toBe(11);
    },
  );

  it("does not lose Armor or gain buildup from fully resisted damage", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { armor: 2 },
      gearEffects: { resistBurn: 100 },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "burn", amount: 6 }, []);
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.armor).toBe(2);
    expect(result.playerStatuses.burn).toBe(0);
  });

  it("Reinforce spends five Block to absorb six Physical damage", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 10 },
      talentEffects: { blockAbsorbPhysicalBonus: 20 },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 6 }, []);
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(5);
    const second = processEnemyDamageEffect(result, { kind: "damage", damageType: "physical", amount: 6 }, []);
    expect(second.playerHealth).toBe(30);
    expect(second.playerStatuses.block).toBe(0);
  });

  it("Reinforce still loses extra Block against Ogre attacks", () => {
    const state = patchBattleState({
      playerStatuses: { block: 15 },
      talentEffects: { blockAbsorbPhysicalBonus: 20 },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 6 }, [], {
      physicalBlockBreakMultiplier: 2,
    });
    expect(result.playerStatuses.block).toBe(5);
  });

  it("fully resisted status ticks preserve Armor", () => {
    const state = patchBattleState({
      playerStatuses: { armor: 2, burn: 6, poison: 6, bleed: 6 },
      gearEffects: { resistBurn: 100, resistPoison: 100, resistBleed: 100 },
    });
    const result = tickPlayerStatuses(state, []);
    expect(result.playerHealth).toBe(state.playerHealth);
    expect(result.playerStatuses.armor).toBe(2);
  });

  it("Overheat deals immediate Burn damage when Anvil crosses four Forge", () => {
    const card = cardById.anvil!;
    const state = patchBattleState({
      hand: [card],
      enemyHealth: 30,
      enemyMaxHealth: 30,
      playerStatuses: { forge: 2 },
      talentEffects: { forgeBurnThreshold: 4, forgeBurnDamage: 8 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.enemyHealth).toBe(22);
    expect(result.enemyStatuses.burn).toBe(8);
  });

  it("Overheat preserves the next card's bonuses and pays kill rewards once", () => {
    const card = cardById.anvil!;
    const state = patchBattleState({
      hand: [card],
      playerHealth: 10,
      playerMaxHealth: 30,
      enemyHealth: 8,
      enemyMaxHealth: 30,
      playerStatuses: { forge: 2 },
      talentEffects: { forgeBurnThreshold: 4, forgeBurnDamage: 8, firstBurnCardBonusMultiplier: 2 },
      flags: { nextHitCrit: true },
      gearEffects: { goldOnKill: 3 },
      trinketEffects: { boneCharmHealOnKill: 2 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(12);
    expect(result.gold).toBe(state.gold + 3);
    expect(result.flags.nextHitCrit).toBe(true);
    expect(result.flags.firstBurnCardDoubledUsed).toBe(false);
  });

  it("Overheat respects Burn resistance for immediate damage and buildup", () => {
    const card = cardById.anvil!;
    const state = patchBattleState({
      hand: [card],
      enemyHealth: 30,
      enemyMaxHealth: 30,
      currentEnemy: { traits: [{ id: "burn-resistance", title: "Burn resistance", description: "" }] },
      playerStatuses: { forge: 2 },
      talentEffects: { forgeBurnThreshold: 4, forgeBurnDamage: 8 },
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.enemyHealth).toBe(26);
    expect(result.enemyStatuses.burn).toBe(4);
  });

  it("Meteor preserves overflow Mana when no Mana Crystal can be lost", () => {
    const card = cardById.meteor!;
    const state = patchBattleState({
      hand: [card],
      mana: 4,
      maxMana: 1,
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.maxMana).toBe(1);
    expect(result.mana).toBe(3);
  });
});
