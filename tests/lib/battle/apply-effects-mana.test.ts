import { describe, expect, it } from "vitest";
import { handleManaEffect } from "@/lib/battle/apply-effects-mana";
import type { CombatTextEvent } from "@/lib/battle/types";
import { MIN_MAX_MANA_FLOOR } from "@/lib/game-constants";
import { createTestBattleState } from "./test-state";

function makeTexts(): CombatTextEvent[] {
  return [];
}

describe("handleManaEffect", () => {
  it("restores mana and emits combat text", () => {
    const state = createTestBattleState({ mana: 2, maxMana: 4 });
    const texts = makeTexts();
    const result = handleManaEffect(state, { kind: "restore-mana", amount: 2 }, 1, texts);
    expect(result.mana).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 2 });
  });

  it("applies potion multiplier to restore-mana", () => {
    const state = createTestBattleState({ mana: 0, maxMana: 4 });
    const texts = makeTexts();
    const result = handleManaEffect(state, { kind: "restore-mana", amount: 3 }, 1.5, texts);
    expect(result.mana).toBe(5);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 5 });
  });

  it("heals on mana gain when healOnManaGain talent is active", () => {
    const state = createTestBattleState({
      mana: 2,
      maxMana: 4,
      playerHealth: 20,
      talentEffects: { ...createTestBattleState().talentEffects, healOnManaGain: 3 },
    });
    const texts = makeTexts();
    const result = handleManaEffect(state, { kind: "restore-mana", amount: 1 }, 1, texts);
    expect(result.playerHealth).toBe(23);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
  });

  it("loses mana without going below zero", () => {
    const state = createTestBattleState({ mana: 1, maxMana: 4 });
    const texts = makeTexts();
    const result = handleManaEffect(state, { kind: "lose-mana", amount: 3 }, 1, texts);
    expect(result.mana).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "mana", amount: 3 });
  });

  it("gains max mana and current mana together", () => {
    const state = createTestBattleState({ mana: 2, maxMana: 4 });
    const texts = makeTexts();
    const result = handleManaEffect(state, { kind: "gain-max-mana", amount: 2 }, 1, texts);
    expect(result.maxMana).toBe(6);
    expect(result.mana).toBe(4);
  });

  it("reduces max mana and clamps current mana to the new cap", () => {
    const state = createTestBattleState({ mana: 4, maxMana: 4 });
    const texts = makeTexts();
    const result = handleManaEffect(state, { kind: "lose-max-mana", amount: 2 }, 1, texts);
    expect(result.maxMana).toBe(2);
    expect(result.mana).toBe(2);
    expect(result.maxMana).toBeGreaterThanOrEqual(MIN_MAX_MANA_FLOOR);
  });

  it("does not drop max mana below MIN_MAX_MANA_FLOOR", () => {
    const state = createTestBattleState({ mana: 1, maxMana: 1 });
    const texts = makeTexts();
    const result = handleManaEffect(state, { kind: "lose-max-mana", amount: 5 }, 1, texts);
    expect(result.maxMana).toBe(MIN_MAX_MANA_FLOOR);
    expect(result.mana).toBe(MIN_MAX_MANA_FLOOR);
  });

  it("burns enemy when losing max mana with burnDamageOnManaCrystalLoss talent", () => {
    const state = createTestBattleState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 20,
      talentEffects: { ...createTestBattleState().talentEffects, burnDamageOnManaCrystalLoss: 3 },
    });
    const texts = makeTexts();
    const result = handleManaEffect(state, { kind: "lose-max-mana", amount: 1 }, 1, texts);
    expect(result.enemyHealth).toBe(17);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 3 });
  });
});
