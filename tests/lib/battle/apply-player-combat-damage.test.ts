import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { applyPlayerCombatDamage } from "@/lib/battle/types";
import type { BattleState } from "@/lib/battle/types";

function talents(partial: Partial<BattleState["talentEffects"]>): BattleState["talentEffects"] {
  return partial as BattleState["talentEffects"];
}

describe("applyPlayerCombatDamage", () => {
  it("returns state unchanged when damage is zero", () => {
    const state = patchBattleState({ playerHealth: 30 });
    expect(applyPlayerCombatDamage(state, 0)).toBe(state);
  });

  it("returns state unchanged when damage is negative", () => {
    const state = patchBattleState({ playerHealth: 30 });
    expect(applyPlayerCombatDamage(state, -5)).toBe(state);
  });

  it("reduces health by damage amount", () => {
    const state = patchBattleState({ playerHealth: 30 });
    const result = applyPlayerCombatDamage(state, 10);
    expect(result.playerHealth).toBe(20);
  });

  it("applies base damage reduction", () => {
    const state = patchBattleState({
      playerHealth: 30,
      talentEffects: talents({ damageReduction: 3 }),
    });
    const result = applyPlayerCombatDamage(state, 10);
    expect(result.playerHealth).toBe(23);
  });

  it("applies burn damage reduction", () => {
    const state = patchBattleState({
      playerHealth: 30,
      talentEffects: talents({ burnDamageReduction: 5 }),
    });
    const result = applyPlayerCombatDamage(state, 15, "burn");
    expect(result.playerHealth).toBe(20);
  });

  it("applies freeze damage reduction", () => {
    const state = patchBattleState({
      playerHealth: 30,
      talentEffects: talents({ freezeDamageReduction: 4 }),
    });
    const result = applyPlayerCombatDamage(state, 10, "freeze");
    expect(result.playerHealth).toBe(24);
  });

  it("applies nature half-damage when receiveHalfNatureDamage is set", () => {
    const state = patchBattleState({
      playerHealth: 30,
      talentEffects: talents({ receiveHalfNatureDamage: true }),
    });
    const result = applyPlayerCombatDamage(state, 10, "nature");
    expect(result.playerHealth).toBe(25);
  });

  it("applies nature damage reduction", () => {
    const state = patchBattleState({
      playerHealth: 30,
      talentEffects: talents({ natureDamageReduction: 3 }),
    });
    const result = applyPlayerCombatDamage(state, 10, "nature");
    expect(result.playerHealth).toBe(23);
  });

  it("applies poison damage reduction", () => {
    const state = patchBattleState({
      playerHealth: 30,
      talentEffects: talents({ poisonDamageReduction: 3 }),
    });
    const result = applyPlayerCombatDamage(state, 8, "poison");
    expect(result.playerHealth).toBe(25);
  });

  it("health does not go below zero", () => {
    const state = patchBattleState({ playerHealth: 5, deathsDoorUsed: true });
    const result = applyPlayerCombatDamage(state, 20);
    expect(result.playerHealth).toBe(0);
  });

  it("activates deaths door on lethal hit if not used", () => {
    const state = patchBattleState({ playerHealth: 5, deathsDoorUsed: false });
    const result = applyPlayerCombatDamage(state, 20);
    expect(result.playerHealth).toBe(1);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.deathsDoorActive).toBe(true);
  });

  it("does not reactivate deaths door if already used", () => {
    const state = patchBattleState({ playerHealth: 5, deathsDoorUsed: true, deathsDoorActive: true });
    const result = applyPlayerCombatDamage(state, 20);
    expect(result.playerHealth).toBe(1);
    expect(result.deathsDoorActive).toBe(true);
    expect(result.deathsDoorUsed).toBe(true);
  });

  it("lethal hit after grace expires kills the player", () => {
    const state = patchBattleState({ playerHealth: 1, deathsDoorUsed: true, deathsDoorActive: false });
    const result = applyPlayerCombatDamage(state, 20);
    expect(result.playerHealth).toBe(0);
    expect(result.deathsDoorActive).toBe(false);
  });
});
