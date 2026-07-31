import { describe, expect, it, vi, afterEach } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { BattleCardEffect } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultTalentEffects,
  defaultTrinketManifest,
} from "../../fixtures/default-battle-state";
import { makeCard, makeEffect, makeTexts } from "./damage-test-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("computeBaseDamage — forge bonus", () => {
  it("adds forge bonus to physical damage", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("adds forge to burn when forgeToBurn talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, forgeToBurn: true },
    });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(23);
    expect(result.playerStatuses.forge).toBe(1);
  });

  it("adds forge to holy when forgeToHoly talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, forgeToHoly: true },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(23);
    expect(result.playerStatuses.forge).toBe(1);
  });

  it("adds forge to bleed when forgeToBleed talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, forgeToBleed: true },
    });
    const card = makeCard({ effects: [makeEffect("bleed", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(1);
  });
});

describe("applyForgeStunRider", () => {
  it("stuns enemy when forge meets boon threshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 5 }),
      trinketEffects: defaultTrinketManifest({ forgeStunThreshold: 4, forgeStunAmount: 2 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 15 }),
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });

  it("does not stun when forge is below threshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      trinketEffects: defaultTrinketManifest({ forgeStunThreshold: 4, forgeStunAmount: 2 }),
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyCC.stunSkipTurns).toBe(0);
  });
});

describe("consumeForgeAfterDamage", () => {
  it("consumes 1 forge after physical damage", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("consumes 1 forge after stun damage", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeCard({ effects: [makeEffect("stun", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("consumes 1 forge after burn damage when forgeToBurn talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 3 }),
      talentEffects: { ...defaultTalentEffects, forgeToBurn: true },
    });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("consumes 1 forge after holy damage when forgeToHoly talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 3 }),
      talentEffects: { ...defaultTalentEffects, forgeToHoly: true },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("does not consume forge for burn damage without talent", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(3);
  });

  it("does not consume forge for holy damage without talent", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(3);
  });
});
