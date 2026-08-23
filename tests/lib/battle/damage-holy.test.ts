import { describe, expect, it } from "vitest";
import { applyDamageBlock } from "@/lib/battle/damage-rider-leech";
import { patchBattleState } from "../../fixtures/battle";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultTalentEffects,
} from "../../fixtures/default-battle-state";
import { dealDamage, makeCombatTexts, makeEffect, makeTestCard } from "../../fixtures/battle";

describe("computeBaseDamage — holy damage", () => {
  it("scales holy damage with gold when holyGoldPercent is active", () => {
    const state = patchBattleState({
      gold: 50,
      talentEffects: { ...defaultTalentEffects, holyGoldPercent: 10 },
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("deals exactly current block when equalToBlock is set", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ block: 7 }) });
    const card = makeTestCard({ effects: [makeEffect("holy", 0, { equalToBlock: true })] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(30 - 7);
  });

  it("scales holy damage with block when blockToHolyDamage is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      talentEffects: { ...defaultTalentEffects, blockToHolyDamage: true },
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("amplifies holy damage against burning enemies with holyVsBurnMultiplier", () => {
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ burn: 5 }),
      talentEffects: { ...defaultTalentEffects, holyVsBurnMultiplier: 0.5 },
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBeLessThan(30);
  });
});

describe("applyHolyDamageRiders", () => {
  it("heals player with holy lifesteal", () => {
    const state = patchBattleState({
      playerHealth: 20,
      talentEffects: { ...defaultTalentEffects, holyLifestealPercent: 50 },
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 10)] });
    const result = dealDamage(state, card);
    expect(result.playerHealth).toBeGreaterThan(20);
  });

  it("grants block from holy damage with holyBlockPercentFromDamage", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ block: 0 }),
      talentEffects: { ...defaultTalentEffects, holyBlockPercentFromDamage: 50 },
      rng: () => 0.5,
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 10)] });
    const result = dealDamage(state, card);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("reports the full block gained in combat text when flatBlockGained is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ block: 0 }),
      talentEffects: { ...defaultTalentEffects, holyBlockPercentFromDamage: 50 },
      gearEffects: { ...patchBattleState().gearEffects, flatBlockGained: 2 },
    });
    const texts = makeCombatTexts();
    const result = applyDamageBlock(state, 10, texts);
    // 50% of 10 = 5 block, plus flatBlockGained 2 in the text (matches the
    // run-state delta from addPlayerStatus).
    expect(result.playerStatuses.block).toBe(7);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 7 });
  });

  it("applies burn on holy damage with holyBurnChance", () => {
    const state = patchBattleState({
      rng: () => 0.01,
      talentEffects: { ...defaultTalentEffects, holyBurnChance: 50, holyLifestealPercent: 0, holyGoldPercent: 0 },
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 10)] });
    const result = dealDamage(state, card);
    expect(result.enemyStatuses.burn).toBeGreaterThan(0);
  });

  it("triggers a wish on holy damage with holyWishChance", () => {
    const state = patchBattleState({
      rng: () => 0.01,
      talentEffects: {
        ...defaultTalentEffects,
        holyWishChance: 50,
        holyLifestealPercent: 0,
      },
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 10)] });
    const result = dealDamage(state, card);
    expect(result.wishOptions).not.toBeNull();
  });

  it("does not trigger a wish when the holyWishChance roll fails", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      talentEffects: { ...defaultTalentEffects, holyWishChance: 50 },
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 10)] });
    const result = dealDamage(state, card);
    expect(result.wishOptions).toBeNull();
  });
});
