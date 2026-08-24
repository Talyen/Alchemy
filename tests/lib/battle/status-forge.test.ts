import { describe, expect, it } from "vitest";
import { addForgeToPlayer } from "@/lib/battle/status-forge";
import { applyPlayerStatusEffect } from "@/lib/battle/status-player";
import { makeCombatTexts as makeTexts, makeTestBattleState } from "../../fixtures/battle";
import { defaultEnemyMitigation } from "../../fixtures/default-battle-state";

describe("applyPlayerStatusEffect � forge integration", () => {
  it("applies forge burn burst when forge crosses threshold", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 3 },
      talentEffects: { ...makeTestBattleState().talentEffects, forgeBurnThreshold: 5, forgeBurnDamage: 4 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(6);
    expect(result.enemyStatuses.burn).toBe(4);
    // Burn application is not floated as damage — the DoT itself deals -N next enemy phase.
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "forge", amount: 3 }]);
  });

  it("flatForgeGained increases forge from card effects", () => {
    const state = makeTestBattleState({
      talentEffects: { ...makeTestBattleState().talentEffects, flatForgeGained: 1 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("strips enemy armor when forge crosses forgeStripArmorThreshold", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 5 },
      enemyMitigation: defaultEnemyMitigation({ armor: 4 }),
      talentEffects: { ...makeTestBattleState().talentEffects, forgeStripArmorThreshold: 6 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("forgeBlockBurst respects forgeToBlock synergy", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 5 },
      talentEffects: {
        ...makeTestBattleState().talentEffects,
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
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 3 },
      talentEffects: { ...makeTestBattleState().talentEffects, forgeBurnThreshold: 4, forgeBurnDamage: 7 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(6);
    expect(result.enemyStatuses.burn).toBe(7);
  });

  it("forge burn burst does NOT fire when oldForge exactly equals threshold (4 -> 7, threshold 4)", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 4 },
      talentEffects: { ...makeTestBattleState().talentEffects, forgeBurnThreshold: 4, forgeBurnDamage: 7 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyStatuses.burn).toBe(0);
  });

  it("forge block burst does NOT re-fire above threshold (7 -> 9, threshold 6)", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 7 },
      talentEffects: { ...makeTestBattleState().talentEffects, forgeBlockThreshold: 6, forgeBlockAmount: 10 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(9);
    expect(result.playerStatuses.block).toBe(0);
  });
});

describe("addForgeToPlayer", () => {
  it("adds flatForgeGained to forge gain", () => {
    const state = makeTestBattleState({
      talentEffects: { ...makeTestBattleState().talentEffects, flatForgeGained: 1 },
    });
    const texts = makeTexts();
    const result = addForgeToPlayer(state, 3, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("does nothing when amount is zero after modifiers", () => {
    const state = makeTestBattleState();
    const result = addForgeToPlayer(state, 0);
    expect(result).toBe(state);
  });
});
