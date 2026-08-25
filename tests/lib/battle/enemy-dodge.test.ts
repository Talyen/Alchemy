import { describe, expect, it } from "vitest";
import { defaultGearEffects } from "@/lib/gear";
import { dealPlayerTypedHit } from "@/lib/battle/player-typed-hit";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { processEnemyAttack } from "@/lib/battle/enemy-turn-attack";
import { dealDamage, makeCombatTexts, makeEffect, makeTestCard, patchBattleState } from "../../fixtures/battle";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";

describe("enemy Dodge", () => {
  it("Dodges a player damage packet before enemy Block and Armor", () => {
    const texts = makeCombatTexts();
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMitigation: { armor: 4, block: 10, forge: 0 },
      rng: () => 0.01,
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 8)] });
    const result = dealDamage(state, card, texts);
    expect(result.enemyHealth).toBe(30);
    expect(result.enemyMitigation.block).toBe(10);
    expect(result.enemyMitigation.armor).toBe(4);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "notice",
      stat: "dodge",
      text: "Dodge",
    });
  });

  it("skips lifesteal and status riders when the enemy Dodges", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 30,
      enemyStatuses: { bleed: 0 },
      rng: () => 0.01,
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(30);
    expect(result.playerHealth).toBe(20);
    expect(result.enemyStatuses.bleed).toBe(0);
  });

  it("does not Dodge DoT ticks", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: { burn: 8 },
      rng: () => 0.01,
    });
    const next = tickEnemyStatuses(state, makeCombatTexts());
    expect(next.enemyHealth).toBe(22);
  });

  it("does not Dodge follow-up typed hits", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      rng: () => 0.01,
    });
    const result = dealPlayerTypedHit(state, "physical", 6, makeCombatTexts());
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("does not trigger player on-Dodge gear when the enemy Dodges", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ block: 0 }),
      deck: [makeTestCard({ id: "counter-strike", effects: [makeEffect("physical", 20)] })],
      rng: () => 0.01,
      gearEffects: { ...defaultGearEffects, dodgeDrawAndPlay: 1, blockOnDodge: 5 },
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 8)] }));
    expect(result.playerStatuses.block).toBe(0);
    expect(result.deck).toHaveLength(1);
    expect(result.enemyHealth).toBe(30);
  });

  it("preserves next-hit buffs (crit, poison conversion, flat bonus, parting cut) when the enemy Dodges", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      rng: () => 0.01,
      flags: {
        ...patchBattleState().flags,
        nextHitCrit: true,
        nextHitPoison: true,
        nextHitPhysicalBonus: 5,
        nextPhysicalDealsBleed: true,
      },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 8)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(30);
    expect(result.flags.nextHitCrit).toBe(true);
    expect(result.flags.nextHitPoison).toBe(true);
    expect(result.flags.nextHitPhysicalBonus).toBe(5);
    expect(result.flags.nextPhysicalDealsBleed).toBe(true);
  });

  it("consumes physical next-hit buffs when a physical attack connects", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      rng: () => 0.99,
      flags: {
        ...patchBattleState().flags,
        nextHitCrit: true,
        nextHitPhysicalBonus: 5,
        nextPhysicalDealsBleed: true,
      },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.flags.nextHitCrit).toBe(false);
    expect(result.flags.nextHitPhysicalBonus).toBe(0);
    expect(result.flags.nextPhysicalDealsBleed).toBe(false);
  });

  it("consumes nextHitPoison when converting an attack to poison", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      rng: () => 0.99,
      flags: {
        ...patchBattleState().flags,
        nextHitPoison: true,
      },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.flags.nextHitPoison).toBe(false);
    expect(result.enemyStatuses.poison).toBeGreaterThan(0);
  });

  it("still deals damage when the Dodge roll misses", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      rng: () => 0.99,
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBe(25);
  });
});

describe("player Dodge chance from gear", () => {
  it("adds gear Dodge chance to the 5% baseline", () => {
    const hits = patchBattleState({
      playerHealth: 30,
      rng: () => 0.07,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    });
    expect(processEnemyAttack(hits, makeCombatTexts()).playerHealth).toBeLessThan(30);

    const dodges = patchBattleState({
      playerHealth: 30,
      rng: () => 0.07,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      gearEffects: { ...defaultGearEffects, dodgeChance: 3 },
    });
    expect(processEnemyAttack(dodges, makeCombatTexts()).playerHealth).toBe(30);
  });
});
