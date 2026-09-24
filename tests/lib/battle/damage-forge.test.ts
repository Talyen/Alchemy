import { addGoldWithCombatText } from "@/lib/battle/player-rewards";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { describe, expect, it } from "vitest";
import { dealDamage, makeEffect, makeTestCard, patchBattleState } from "../../fixtures/battle";
import {
  defaultEnemyStatusValues,
  defaultPlayerStatusValues,
  defaultTalentEffects,
  defaultTrinketManifest,
} from "../../fixtures/default-battle-state";
import * as uniqueGearBattle from "../../fixtures/unique-gear-battle";

describe("computeBaseDamage — forge bonus", () => {
  it("adds forge bonus to physical damage", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("adds forge to burn when forgeToBurn talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, forgeToBurn: true },
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(23);
    expect(result.playerStatuses.forge).toBe(1);
  });

  it("adds forge to holy when forgeToHoly talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, forgeToHoly: true },
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(23);
    expect(result.playerStatuses.forge).toBe(1);
  });

  it("adds forge to bleed when forgeToBleed talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, forgeToBleed: true },
    });
    const card = makeTestCard({ effects: [makeEffect("bleed", 5)] });
    const result = dealDamage(state, card);
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
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });

  it("does not stun when forge is below threshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      trinketEffects: defaultTrinketManifest({ forgeStunThreshold: 4, forgeStunAmount: 2 }),
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyCC.stunSkipTurns).toBe(0);
  });
});

describe("consumeForgeAfterDamage", () => {
  it("consumes 1 forge after physical damage", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("consumes 1 forge after stun damage", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeTestCard({ effects: [makeEffect("stun", 5)] });
    const result = dealDamage(state, card);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("consumes 1 forge after burn damage when forgeToBurn talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 3 }),
      talentEffects: { ...defaultTalentEffects, forgeToBurn: true },
    });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const result = dealDamage(state, card);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("consumes 1 forge after holy damage when forgeToHoly talent is active", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 3 }),
      talentEffects: { ...defaultTalentEffects, forgeToHoly: true },
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 5)] });
    const result = dealDamage(state, card);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("does not consume forge for burn damage without talent", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeTestCard({ effects: [makeEffect("burn", 5)] });
    const result = dealDamage(state, card);
    expect(result.playerStatuses.forge).toBe(3);
  });

  it("does not consume forge for holy damage without talent", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeTestCard({ effects: [makeEffect("holy", 5)] });
    const result = dealDamage(state, card);
    expect(result.playerStatuses.forge).toBe(3);
  });
});

describe("Unique Gear damage forge", () => {
  const { battle, attack, play } = uniqueGearBattle;

  it("Oathkeeper strengthens Holy damage without spending Forge", () => {
    const result = play(
      battle({ gearEffects: { holyPreservesForge: 1 }, playerStatuses: { forge: 5 } }),
      attack("holy"),
    );
    expect(result.enemyHealth).toBe(985);
    expect(result.playerStatuses.forge).toBe(5);
  });

  it("Patient Edge restores only Forge spent on attacks, once per turn", () => {
    const state = play(
      battle({ gearEffects: { recoverSpentForge: 1 }, playerStatuses: { forge: 5 } }),
      attack("physical"),
    );
    expect(state.playerStatuses.forge).toBe(4);
    expect(state.uniqueGear.spentForge).toBe(1);
    const restored = advanceToPlayerTurn(state);
    expect(restored.playerStatuses.forge).toBe(5);
    expect(restored.uniqueGear.spentForge).toBe(0);
    expect(advanceToPlayerTurn(restored).playerStatuses.forge).toBe(5);
  });

  it("Patient Edge recovery triggers crossed Forge thresholds without multiplying the recovered amount", () => {
    const initial = battle({
      gearEffects: { recoverSpentForge: 1 },
      playerStatuses: { forge: 5 },
      enemyMitigation: { armor: 4 },
      uniqueGear: { spentForge: 1 },
      talentEffects: { flatForgeGained: 3, forgeStripArmorThreshold: 6, forgeBlockThreshold: 6, forgeBlockAmount: 10 },
    });
    const restored = advanceToPlayerTurn(initial);
    expect(restored.playerStatuses.forge).toBe(6);
    expect(restored.enemyMitigation.armor).toBe(0);
    expect(restored.playerStatuses.block).toBe(10);
    expect(restored.uniqueGear.spentForge).toBe(0);
    expect(advanceToPlayerTurn(restored).playerStatuses.block).toBe(5);
  });

  it("Golden Crucible grants actual Gold as Forge, spends no Gold, and strengthens Holy", () => {
    const earned = addGoldWithCombatText(
      battle({ gold: 50, gearEffects: { goldGrantsForgeAndHoly: 1, goldGainPercent: 20 } }),
      5,
    );
    expect(earned.gold).toBe(56);
    expect(earned.playerStatuses.forge).toBe(6);
    const result = play(earned, attack("holy"));
    expect(result.enemyHealth).toBe(984);
    expect(result.playerStatuses.forge).toBe(5);
    expect(result.gold).toBe(56);
  });

  it("Golden Verdict feeds Golden Crucible while Oathkeeper preserves the resulting Forge", () => {
    const result = play(
      battle({
        gold: 25,
        enemyStatuses: { stun: 495 },
        gearEffects: { holyStunBuildupGold: 1, goldGrantsForgeAndHoly: 1, holyPreservesForge: 1 },
      }),
      attack("holy"),
    );
    expect(result.gold).toBe(26);
    expect(result.playerStatuses.forge).toBe(1);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });
});
