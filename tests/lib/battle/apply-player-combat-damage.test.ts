import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { applyPlayerCombatDamage, playerHealthLostToDamage } from "@/lib/battle/health-state";
import { DEATHS_DOOR_GRACE_TURNS } from "@/lib/game-constants";

describe("applyPlayerCombatDamage", () => {
  it("combines flat reduction, resistance, and Block's DoT protection once", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 1 },
      talentEffects: { poisonDamageReduction: 2, blockHalvesPoisonDamage: true },
      gearEffects: { resistPoison: 50 },
    });
    const result = applyPlayerCombatDamage(state, 14, "hostile", "poison");
    expect(result.playerHealth).toBe(27);
    expect(playerHealthLostToDamage(state, result)).toBe(3);
    expect(state.playerHealth).toBe(30);
    expect(applyPlayerCombatDamage(state, 2, "hostile", "poison")).toBe(state);
  });

  it("can bypass player mitigation for trait-authored damage", () => {
    const state = patchBattleState({
      playerHealth: 30,
      talentEffects: { burnDamageReduction: 5 },
    });
    const result = applyPlayerCombatDamage(state, 10, "hostile", "burn", { ignoreMitigation: true });
    expect(result.playerHealth).toBe(20);
  });

  it("activates deaths door on lethal hit if not used", () => {
    const state = patchBattleState({ playerHealth: 5, deathsDoorUsed: false, turn: 3 });
    const result = applyPlayerCombatDamage(state, 20, "hostile");
    expect(result.playerHealth).toBe(1);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.deathsDoorActive).toBe(true);
    expect(result.deathsDoorTriggeredTurn).toBe(3);
    expect(result.deathsDoorGraceTurnsRemaining).toBe(DEATHS_DOOR_GRACE_TURNS);
    expect(playerHealthLostToDamage(state, result)).toBe(4);
  });

  it("does not reactivate deaths door if already used", () => {
    const state = patchBattleState({ playerHealth: 5, deathsDoorUsed: true, deathsDoorActive: true });
    const result = applyPlayerCombatDamage(state, 20, "hostile");
    expect(result.playerHealth).toBe(1);
    expect(result.deathsDoorActive).toBe(true);
    expect(result.deathsDoorUsed).toBe(true);
    expect(playerHealthLostToDamage(state, result)).toBe(4);
  });

  it("lethal hit after grace expires kills the player", () => {
    const state = patchBattleState({ playerHealth: 1, deathsDoorUsed: true, deathsDoorActive: false });
    const result = applyPlayerCombatDamage(state, 20, "hostile");
    expect(result.playerHealth).toBe(0);
    expect(result.deathsDoorActive).toBe(false);
    expect(playerHealthLostToDamage(state, result)).toBe(1);
  });

  it("keeps the player defeated when damage hits at zero health after grace", () => {
    const state = patchBattleState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: 3,
    });
    const result = applyPlayerCombatDamage(state, 5, "hostile");
    expect(result.playerHealth).toBe(0);
    expect(result.deathsDoorActive).toBe(false);
  });

  it("phoenix feather restores 30% max health and clears the feather instead of dying", () => {
    const state = patchBattleState({
      playerHealth: 5,
      playerMaxHealth: 30,
      playerStatuses: { phoenixFeather: 1 },
    });
    const result = applyPlayerCombatDamage(state, 20, "hostile");
    expect(result.playerHealth).toBe(9);
    expect(result.playerStatuses.phoenixFeather).toBe(0);
    expect(playerHealthLostToDamage(state, result)).toBe(5);
    expect(result.deathsDoorUsed).toBe(false);
    expect(result.deathsDoorActive).toBe(false);
  });
});
