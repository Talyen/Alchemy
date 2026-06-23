import { describe, expect, it, vi, afterEach } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { BattleCardEffect } from "@/lib/game-data";
import { patchBattleState } from "./test-state";
import { defaultTalentEffects, defaultTrinketManifest } from "../../fixtures/default-battle-state";
import { makeCard, makeEffect, makeTexts } from "./damage-test-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dealDamageToEnemy — enemy armor", () => {
  it("physical damage is reduced by enemy armor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({ enemyMitigation: { armor: 3, forge: 0, freezeBonus: 0, burnBonus: 0, block: 0 } });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(30 - 10 + 3);
  });

  it("sunderingArmorPiercing removes enemy armor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0, burnBonus: 0, block: 0 },
      trinketEffects: defaultTrinketManifest({ sunderingArmorPiercing: 2 }),
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(23);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it("non-physical damage ignores enemy armor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({ enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0, burnBonus: 0, block: 0 } });
    const card = makeCard({ effects: [makeEffect("burn", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(20);
  });
});

describe("dealDamageToEnemy — boonSiphon siphoning", () => {
  it("steals armor and gains armor for the player when armor is siphoned", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyMitigation: { armor: 5, block: 0, forge: 0, freezeBonus: 0, burnBonus: 0 },
      talentEffects: { ...defaultTalentEffects, trinketSiphonChance: 100 },
      rng: () => 0.1,
    });
    const card = makeCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyMitigation.armor).toBe(3);
    expect(result.playerStatuses.armor).toBe(1);
  });

  it("steals forge and gains forge for the player when forge is siphoned", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = patchBattleState({
      enemyMitigation: { armor: 0, block: 0, forge: 3, freezeBonus: 0, burnBonus: 0 },
      talentEffects: { ...defaultTalentEffects, trinketSiphonChance: 100 },
      rng: () => 0.0,
    });
    const card = makeCard({ effects: [makeEffect("nature", 10, { lifesteal: true })] });
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      makeTexts(),
    );
    expect(result.enemyMitigation.forge).toBe(2);
    expect(result.playerStatuses.forge).toBe(1);
  });
});
