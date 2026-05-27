import { describe, expect, it } from "vitest";
import { addForgeToPlayer, applyStunForgeTalent } from "@/lib/battle/status-forge";
import { applyPlayerStatusEffect } from "@/lib/battle/status-player";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";

function makeTexts(): CombatTextEvent[] {
  return [];
}

describe("applyPlayerStatusEffect — forge integration", () => {
  it("applies forge burn burst when forge crosses threshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 3 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeBurnThreshold: 5, forgeBurnDamage: 4 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(6);
    expect(result.enemyStatuses.burn).toBe(4);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 4 });
  });

  it("flatForgeGained increases forge from card effects", () => {
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, flatForgeGained: 1 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("strips enemy armor when forge crosses forgeStripArmorThreshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 5 },
      enemyMitigation: { armor: 4, forge: 0, freezeBonus: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeStripArmorThreshold: 6 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("forgeBlockBurst respects forgeToBlock synergy", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 5 },
      talentEffects: {
        ...createTestBattleState().talentEffects,
        forgeToBlock: true,
        forgeBlockThreshold: 6,
        forgeBlockAmount: 10,
      },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.playerStatuses.block).toBe(17);
  });
});

describe("forge threshold boundaries", () => {
  it("forge burn burst fires on crossing threshold from below (3 -> 6, threshold 4)", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 3 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeBurnThreshold: 4, forgeBurnDamage: 7 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(6);
    expect(result.enemyStatuses.burn).toBe(7);
  });

  it("forge burn burst does NOT fire when oldForge exactly equals threshold (4 -> 7, threshold 4)", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 4 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeBurnThreshold: 4, forgeBurnDamage: 7 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyStatuses.burn).toBe(0);
  });

  it("forge block burst does NOT re-fire above threshold (7 -> 9, threshold 6)", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 7 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeBlockThreshold: 6, forgeBlockAmount: 10 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(9);
    expect(result.playerStatuses.block).toBe(0);
  });
});

describe("addForgeToPlayer", () => {
  it("adds flatForgeGained to forge gain", () => {
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, flatForgeGained: 1 },
    });
    const texts = makeTexts();
    const result = addForgeToPlayer(state, 3, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("does nothing when amount is zero after modifiers", () => {
    const state = createTestBattleState();
    const result = addForgeToPlayer(state, 0);
    expect(result).toBe(state);
  });
});

describe("applyStunForgeTalent", () => {
  it("grants forge when forgeOnStun is configured", () => {
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, forgeOnStun: 2 },
    });
    const texts = makeTexts();
    const result = applyStunForgeTalent(state, texts);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("no-ops when forgeOnStun is zero", () => {
    const state = createTestBattleState();
    expect(applyStunForgeTalent(state)).toBe(state);
  });
});
