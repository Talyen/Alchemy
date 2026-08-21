import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { defaultTalentEffects, defaultTrinketManifest } from "../../fixtures/default-battle-state";
import { dealDamage, makeEffect, makeTestCard } from "../../fixtures/battle";

describe("dealDamageToEnemy — enemy armor", () => {
  it("physical damage is reduced by enemy armor", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 3, forge: 0, block: 0 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(30 - 10 + 3);
  });

  it("sunderingArmorPiercing removes enemy armor", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 5, forge: 0, block: 0 },
      trinketEffects: defaultTrinketManifest({ sunderingArmorPiercing: 2 }),
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(23);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it("Piercing Shot ignores 1 Armor on Archery physical hits", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 3, forge: 0, block: 0 },
      talentEffects: { ...defaultTalentEffects, archeryArmorPiercing: 1 },
    });
    const card = makeTestCard({
      tags: ["archery"],
      effects: [makeEffect("physical", 10)],
    });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(22);
    expect(result.enemyMitigation.armor).toBe(1);
  });

  it("non-physical damage ignores enemy armor", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 5, forge: 0, block: 0 },
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 10)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(20);
  });
});

describe("dealDamageToEnemy — boonSiphon siphoning", () => {
  it("steals armor and gains armor for the player when armor is siphoned", () => {
    const state = patchBattleState({
      enemyMitigation: { armor: 5, block: 0, forge: 0 },
      talentEffects: { ...defaultTalentEffects, trinketSiphonChance: 100 },
      rng: () => 0.1,
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyMitigation.armor).toBe(3);
    expect(result.playerStatuses.armor).toBe(1);
  });

  it("steals forge and gains forge for the player when forge is siphoned", () => {
    const state = patchBattleState({
      enemyMitigation: { armor: 0, block: 0, forge: 3 },
      talentEffects: { ...defaultTalentEffects, trinketSiphonChance: 100 },
      rng: () => 0.0,
    });
    const card = makeTestCard({ effects: [makeEffect("nature", 10, { lifesteal: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyMitigation.forge).toBe(2);
    expect(result.playerStatuses.forge).toBe(1);
  });
});
