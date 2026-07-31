import { describe, expect, it, vi, afterEach } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { BattleCardEffect } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultTalentEffects,
} from "../../fixtures/default-battle-state";
import { makeCard, makeEffect, makeTexts } from "./damage-test-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("computeBaseDamage — holy damage", () => {
  it("scales holy damage with gold when holyGoldPercent is active", () => {
    const state = patchBattleState({
      gold: 50,
      talentEffects: { ...defaultTalentEffects, holyGoldPercent: 10 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("scales holy damage with block when holyBlockPercent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      talentEffects: { ...defaultTalentEffects, holyBlockPercent: 20 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("amplifies holy damage against burning enemies with holyVsBurnMultiplier", () => {
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ burn: 5 }),
      talentEffects: { ...defaultTalentEffects, holyVsBurnMultiplier: 0.5 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });
});

describe("applyHolyDamageRiders", () => {
  it("heals player with holy lifesteal", () => {
    const state = patchBattleState({
      playerHealth: 20,
      talentEffects: { ...defaultTalentEffects, holyLifestealPercent: 50 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerHealth).toBeGreaterThan(20);
  });

  it("grants block from holy damage with holyBlockPercentFromDamage", () => {
    const state = patchBattleState({
      gold: 50,
      talentEffects: {
        ...patchBattleState().talentEffects,
        holyBlockPercentFromDamage: 25,
        holyGoldPercent: 10,
        holyLifestealPercent: 0,
      },
    });
    const card = makeCard({ effects: [makeEffect("holy", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.block).toBeGreaterThan(0);
  });

  it("applies burn on holy damage with holyBurnChance", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const state = patchBattleState({
      talentEffects: { ...defaultTalentEffects, holyBurnChance: 50, holyLifestealPercent: 0, holyGoldPercent: 0 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyStatuses.burn).toBeGreaterThan(0);
  });
});
