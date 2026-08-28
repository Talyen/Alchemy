import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { defaultEnemyStatusValues, defaultTalentEffects, defaultCcState } from "../../fixtures/default-battle-state";
import { dealDamage, makeEffect, makeTestCard } from "../../fixtures/battle";

describe("computeBaseDamage — archery tag", () => {
  it("adds flatArrowDamage to cards with the archery tag", () => {
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, flatArrowDamage: 3 },
    });
    const card = makeTestCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 5)],
    });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBeLessThan(25);
  });

  it("triggers extra hit once without infinite recursion when archeryPlayTwiceChance is 100%", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      talentEffects: { ...defaultTalentEffects, archeryPlayTwiceChance: 100 },
    });
    const card = makeTestCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 20)],
    });
    const result = dealDamage(state, card);

    expect(result.enemyHealth).toBe(70);
  });

  it("Longshot doubles archery damage above 75% Health but not at 75%", () => {
    const card = makeTestCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 10)],
    });
    const high = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 76,
      enemyMaxHealth: 100,
      talentEffects: { ...defaultTalentEffects, archeryDoubledVsHighHealth: true },
    });
    const atThreshold = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 75,
      enemyMaxHealth: 100,
      talentEffects: { ...defaultTalentEffects, archeryDoubledVsHighHealth: true },
    });
    expect(dealDamage(high, card).enemyHealth).toBe(56);
    expect(dealDamage(atThreshold, card).enemyHealth).toBe(65);
  });

  it("Kill Shot doubles archery damage at or below 30% Health", () => {
    const card = makeTestCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 10)],
    });
    const low = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 30,
      enemyMaxHealth: 100,
      talentEffects: { ...defaultTalentEffects, archeryDoubledVsLowHealth: true },
    });
    const above = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 31,
      enemyMaxHealth: 100,
      talentEffects: { ...defaultTalentEffects, archeryDoubledVsLowHealth: true },
    });
    expect(dealDamage(low, card).enemyHealth).toBe(10);
    expect(dealDamage(above, card).enemyHealth).toBe(21);
  });

  it("Trophy Shot grants gold when an Archery card defeats an enemy", () => {
    const card = makeTestCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 20)],
    });
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 10,
      enemyMaxHealth: 100,
      gold: 0,
      talentEffects: { ...defaultTalentEffects, goldOnArcheryKill: 2 },
    });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(0);
    expect(result.gold).toBe(2);
  });

  it("Broadhead applies Bleed when the archery rider procs", () => {
    const card = makeTestCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 8)],
    });
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      talentEffects: { ...defaultTalentEffects, archeryBleedChance: 100 },
      rng: () => 0.1,
    });
    const result = dealDamage(state, card);
    expect(result.enemyStatuses.bleed).toBeGreaterThan(0);
  });
});

describe("computeBaseDamage — stun damage", () => {
  it("adds flatStunDamage to stun damage type", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      talentEffects: { ...defaultTalentEffects, flatStunDamage: 2 },
    });
    const card = makeTestCard({ effects: [makeEffect("stun", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(23);
  });
});

describe("computeBaseDamage — physical vs statuses", () => {
  it("adds poisonPhysicalBonus against poisoned enemies", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyStatuses: defaultEnemyStatusValues({ poison: 5 }),
      talentEffects: { ...defaultTalentEffects, poisonPhysicalBonus: 3 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(22);
  });

  it("adds bleedPhysicalBonus against bleeding enemies", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 5 }),
      talentEffects: { ...defaultTalentEffects, bleedPhysicalBonus: 2 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(23);
  });

  it("amplifies physical damage against stunned enemies", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, physicalDoubledVsStunned: true },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(10);
  });

  it("amplifies physical damage against frozen enemies", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, physicalDoubledVsFrozen: true },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(10);
  });
});
