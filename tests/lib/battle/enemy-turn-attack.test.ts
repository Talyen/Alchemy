import { describe, expect, it } from "vitest";
import { processEnemyAttack } from "@/lib/battle/enemy-turn-attack";
import type { CombatTextEvent } from "@/lib/battle/types";
import { BATTLE_CONFIG } from "@/lib/game-constants";
import { createTestBattleState } from "./test-state";

function makeTexts(): CombatTextEvent[] {
  return [];
}

describe("processEnemyAttack", () => {
  it("player block absorbs before health", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 10, armor: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.block).toBe(5);
    expect(result.playerHealth).toBe(30);
  });

  it("applies enemy forge bonus to physical damage", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyMitigation: { ...createTestBattleState().enemyMitigation, forge: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(22);
  });

  it("applies burn status rider on burn damage dealt", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "burn", amount: 4 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.burn).toBe(4);
    expect(result.playerHealth).toBe(26);
  });

  it("triggers Death's Door fields when attack is lethal", () => {
    const state = createTestBattleState({
      playerHealth: 5,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 0 },
      deathsDoorUsed: false,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      turn: 3,
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(0);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.deathsDoorActive).toBe(true);
    expect(result.deathsDoorTriggeredTurn).toBe(3);
  });

  it("player armor reduces physical damage before health", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(25);
  });

  it("halves holy damage when receiveHalfHolyDamage talent is active", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, receiveHalfHolyDamage: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 10 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(25);
  });

  it("adds enemy burnBonus to burn damage", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0 },
      enemyMitigation: { ...createTestBattleState().enemyMitigation, burnBonus: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "burn", amount: 4 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(24);
  });

  it("reduces incoming damage when enemy is poisoned and poisonReducesEnemyDamage is active", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyStatuses: { ...createTestBattleState().enemyStatuses, poison: 3 },
      talentEffects: { ...createTestBattleState().talentEffects, poisonReducesEnemyDamage: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 7 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(25);
  });

  it("increases block absorption for physical hits with blockAbsorbPhysicalBonus", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 10, armor: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, blockAbsorbPhysicalBonus: 20 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 11 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(0);
  });

  it("decays player armor when health damage is taken", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.armor).toBe(3 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
  });

  it("grants block when armor breaks with armorBreakBlock talent", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 1 },
      talentEffects: { ...createTestBattleState().talentEffects, armorBreakBlock: 5 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    });
    const texts = makeTexts();
    const result = processEnemyAttack(state, texts);
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.playerStatuses.block).toBe(5);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 5 });
  });

  it("decays enemy forge after dealing physical health damage", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyMitigation: { ...createTestBattleState().enemyMitigation, forge: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.enemyMitigation.forge).toBe(3 - BATTLE_CONFIG.FORGE_DECAY_AMOUNT);
  });

  it("heals enemy for half damage on lifesteal attacks", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5, lifesteal: true }],
    });
    const texts = makeTexts();
    const result = processEnemyAttack(state, texts);
    expect(result.enemyHealth).toBe(23);
    expect(texts).toContainEqual({ target: "enemy", kind: "heal", stat: "health", amount: 3 });
  });

  it("does not heal enemy on lifesteal when blockEnemyLeech talent is active", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyHealth: 20,
      enemyMaxHealth: 30,
      talentEffects: { ...createTestBattleState().talentEffects, blockEnemyLeech: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5, lifesteal: true }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.enemyHealth).toBe(20);
  });

  it("does not heal enemy on lifesteal when freeze blocks regen", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyCC: { freezeSkipTurns: 1 },
      talentEffects: { ...createTestBattleState().talentEffects, freezeBlocksRegen: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5, lifesteal: true }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.enemyHealth).toBe(20);
  });

  it("applies player-status attack effects", () => {
    const state = createTestBattleState({
      enemyAttackEffects: [{ kind: "player-status", status: "stun", amount: 2 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.stun).toBe(2);
  });

  it("grants forge from vanguard crest when block fully absorbs the attack", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 10, armor: 0 },
      trinketEffects: { ...createTestBattleState().trinketEffects, vanguardCrestForgeOnBlockAbsorb: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const texts = makeTexts();
    const result = processEnemyAttack(state, texts);
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.forge).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 2 });
  });

  it("heals player when block is depleted with blockDepletedHeal talent", () => {
    const state = createTestBattleState({
      playerHealth: 20,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 2, armor: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, blockDepletedHeal: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(15);
  });

  it("consumes phoenix feather and resurrects player when attack is lethal", () => {
    const state = createTestBattleState({
      playerHealth: 5,
      playerMaxHealth: 30,
      playerStatuses: {
        ...createTestBattleState().playerStatuses,
        block: 0,
        armor: 0,
        phoenixFeather: 1,
      },
      deathsDoorUsed: false,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    // Phoenix Feather heals for 30% of max health (9)
    expect(result.playerHealth).toBe(9);
    expect(result.playerStatuses.phoenixFeather).toBe(0);
    expect(result.deathsDoorUsed).toBe(false);
    expect(result.deathsDoorActive).toBe(false);
  });
});
