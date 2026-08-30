import { describe, expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import { processEnemyAttack } from "@/lib/battle/enemy-turn-attack";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { BATTLE_CONFIG } from "@/lib/game-constants";
import { makeCombatTexts as makeTexts, makeTestBattleState } from "../../fixtures/battle";
import { defaultCcState } from "../../fixtures/default-battle-state";

describe("processEnemyAttack", () => {
  it("player block absorbs before health", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 10, armor: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.block).toBe(5);
    expect(result.playerHealth).toBe(30);
  });

  it("applies enemy forge bonus to physical damage", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, forge: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(22);
  });

  it("applies burn status rider on burn damage dealt", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "burn", amount: 4 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.burn).toBe(4);
    expect(result.playerHealth).toBe(26);
  });

  it("triggers Death's Door fields when attack is lethal", () => {
    const state = makeTestBattleState({
      playerHealth: 5,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      deathsDoorUsed: false,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      turn: 3,
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(1);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.deathsDoorActive).toBe(true);
    expect(result.deathsDoorTriggeredTurn).toBe(3);
  });

  it("player armor reduces physical damage before health", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(25);
  });

  it("halves holy damage when receiveHalfHolyDamage talent is active", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      talentEffects: { ...makeTestBattleState().talentEffects, receiveHalfHolyDamage: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 10 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(25);
  });

  it("halves freeze damage and buildup when receiveHalfFreezeDamage talent is active", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      talentEffects: { ...makeTestBattleState().talentEffects, receiveHalfFreezeDamage: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "freeze", amount: 10 }],
    });
    const result = processEnemyAttack(state, makeTexts());

    expect(result.playerHealth).toBe(25);
    expect(result.playerStatuses.freeze).toBe(5);
  });

  it("halves enemy burn damage and burn stacks when receiveHalfBurnDamage is active", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      talentEffects: { ...makeTestBattleState().talentEffects, receiveHalfBurnDamage: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "burn", amount: 4 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(28);
    expect(result.playerStatuses.burn).toBe(2);
  });

  it("halves enemy nature damage when receiveHalfNatureDamage is active", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      talentEffects: { ...makeTestBattleState().talentEffects, receiveHalfNatureDamage: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "nature", amount: 10 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(25);
  });

  it("adds enemy burnBonus to burn damage", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0 },
      enemyStatuses: { ...makeTestBattleState().enemyStatuses, burnBonus: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "burn", amount: 4 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(24);
  });

  it("adds enemy freezeBonus to freeze damage and buildup", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0 },
      enemyStatuses: { ...makeTestBattleState().enemyStatuses, freezeBonus: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "freeze", amount: 4 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(24);
    expect(result.playerStatuses.freeze).toBe(6);
  });

  it("reduces incoming damage when enemy is poisoned and poisonReducesEnemyDamage is active", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyStatuses: { ...makeTestBattleState().enemyStatuses, poison: 3 },
      talentEffects: { ...makeTestBattleState().talentEffects, poisonReducesEnemyDamage: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 7 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(25);
  });

  it("increases block absorption for physical hits with blockAbsorbPhysicalBonus", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 10, armor: 0 },
      talentEffects: { ...makeTestBattleState().talentEffects, blockAbsorbPhysicalBonus: 20 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 11 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(0);
  });

  it("decays player armor when health damage is taken", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.armor).toBe(3 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
  });

  it("grants block when armor breaks with armorBreakBlock talent", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 1 },
      talentEffects: { ...makeTestBattleState().talentEffects, armorBreakBlock: 5 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    });
    const texts = makeTexts();
    const result = processEnemyAttack(state, texts);
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.playerStatuses.block).toBe(5);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 5 });
  });

  it("decays enemy forge after dealing physical health damage", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, forge: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.enemyMitigation.forge).toBe(3 - BATTLE_CONFIG.FORGE_DECAY_AMOUNT);
  });

  it("heals enemy for half damage on lifesteal attacks", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
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
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyHealth: 20,
      enemyMaxHealth: 30,
      talentEffects: { ...makeTestBattleState().talentEffects, blockEnemyLeech: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5, lifesteal: true }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.enemyHealth).toBe(20);
  });

  it("does not heal enemy on lifesteal when freeze blocks regen", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: { ...makeTestBattleState().talentEffects, freezeBlocksRegen: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5, lifesteal: true }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.enemyHealth).toBe(20);
  });

  it("applies player-status attack effects", () => {
    const state = makeTestBattleState({
      enemyAttackEffects: [{ kind: "player-status", status: "poison", amount: 2 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.poison).toBe(2);
  });

  it("armor reduces direct stun status attacks by default", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 3 },
      enemyAttackEffects: [{ kind: "player-status", status: "stun", amount: 5 }],
    });
    const texts = makeTexts();
    const result = processEnemyAttack(state, texts);
    expect(result.playerHealth).toBe(28);
    expect(result.playerStatuses.stun).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "stun", amount: 2 });
  });

  it("immediately triggers player stun when incoming buildup reaches threshold", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "stun", amount: 20 }],
    });
    const texts = makeTexts();
    const result = processEnemyAttack(state, texts);
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCC.stunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("Grounding prevents stun buildup when the player has block", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 4, armor: 0 },
      talentEffects: { ...makeTestBattleState().talentEffects, blockPreventsStun: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "stun", amount: 8 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCC.stunSkipTurns).toBe(0);
  });

  it("Grounding still prevents stun buildup when the hit spends the last Block", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 3, armor: 0 },
      talentEffects: { ...makeTestBattleState().talentEffects, blockPreventsStun: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "stun", amount: 10 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCC.stunSkipTurns).toBe(0);
  });

  it("immediately triggers player freeze when incoming buildup reaches threshold", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "freeze", amount: 20 }],
    });
    const texts = makeTexts();
    const result = processEnemyAttack(state, texts);
    expect(result.playerStatuses.freeze).toBe(0);
    expect(result.playerCC.freezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "freeze", text: "Frozen" });
  });

  it("grants forge from vanguard crest when block fully absorbs the attack", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 10, armor: 0 },
      trinketEffects: { ...makeTestBattleState().trinketEffects, vanguardCrestForgeOnBlockAbsorb: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const texts = makeTexts();
    const result = processEnemyAttack(state, texts);
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.forge).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 2 });
  });

  it("heals player when block is depleted with blockDepletedHeal talent", () => {
    const state = makeTestBattleState({
      playerHealth: 20,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 2, armor: 0 },
      talentEffects: { ...makeTestBattleState().talentEffects, blockDepletedHeal: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(15);
  });

  it("emits actual health gained when block-depleted heal overheals", () => {
    const texts = makeTexts();
    const state = makeTestBattleState({
      playerHealth: 29,
      playerMaxHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 5, armor: 0 },
      talentEffects: { ...makeTestBattleState().talentEffects, blockDepletedHeal: 4 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const result = processEnemyAttack(state, texts);
    expect(result.playerHealth).toBe(30);
    expect(texts.find((t) => t.kind === "heal")).toEqual({
      target: "player",
      kind: "heal",
      stat: "health",
      amount: 1,
    });
  });

  it("consumes phoenix feather and resurrects player when attack is lethal", () => {
    const state = makeTestBattleState({
      playerHealth: 5,
      playerMaxHealth: 30,
      playerStatuses: {
        ...makeTestBattleState().playerStatuses,
        block: 0,
        armor: 0,
        phoenixFeather: 1,
      },
      deathsDoorUsed: false,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const result = processEnemyAttack(state, makeTexts());

    expect(result.playerHealth).toBe(9);
    expect(result.playerStatuses.phoenixFeather).toBe(0);
    expect(result.deathsDoorUsed).toBe(false);
    expect(result.deathsDoorActive).toBe(false);
  });

  it("Dodges an enemy damage packet before Block and Armor", () => {
    const texts = makeTexts();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 10, armor: 5 },
      rng: () => 0.01,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    });
    const result = processEnemyAttack(state, texts);
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(10);
    expect(result.playerStatuses.armor).toBe(5);
    expect(texts).toContainEqual({
      target: "player",
      kind: "notice",
      stat: "dodge",
      text: "Dodge",
    });
  });

  it("does not Dodge status-only enemy attacks", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, poison: 0 },
      rng: () => 0.01,
      enemyAttackEffects: [{ kind: "player-status", status: "poison", amount: 4 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.poison).toBe(4);
  });

  it("does not Dodge encounter-style damage that omits canDodge", () => {
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 0 },
      rng: () => 0.01,
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 8 }, makeTexts());
    expect(result.playerHealth).toBeLessThan(30);
  });

  it("banshee purges one defensive status in priority order block→armor→forge→haste", () => {
    const banshee = enemyBestiary.find((e) => e.id === "banshee")!;
    const base = makeTestBattleState({
      currentEnemy: banshee,
      enemyAttackEffects: banshee.attackEffects,
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 10, armor: 2, forge: 1, haste: 1 },
      rng: () => 0.99,
    });
    const texts = makeTexts();
    const purgedBlock = processEnemyAttack(base, texts);
    expect(purgedBlock.playerStatuses.block).toBe(0);
    expect(purgedBlock.playerStatuses.armor).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "block", text: "Purged" });

    const noBlock = makeTestBattleState({
      currentEnemy: banshee,
      enemyAttackEffects: banshee.attackEffects,
      playerHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 0, armor: 2, forge: 1, haste: 1 },
      rng: () => 0.99,
    });
    const purgedArmor = processEnemyAttack(noBlock, []);
    expect(purgedArmor.playerStatuses.armor).toBe(0);
    expect(purgedArmor.playerStatuses.forge).toBe(1);
  });

  it("blood-countess damages itself on player heal (and also on enemy heal per trait)", async () => {
    const { applyEnemyHealingWithCombatText, applyHealingWithCombatText } = await import("@/lib/battle/combat-text");
    const countessState = makeTestBattleState({
      currentEnemy: enemyBestiary.find((e) => e.id === "blood-countess")!,
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 10,
      enemyMaxHealth: 10,
    });
    const healed = applyHealingWithCombatText(countessState, 5, []);
    expect(healed.enemyHealth).toBe(9);
    expect(healed.playerHealth).toBe(25);

    const enemyHealState = makeTestBattleState({
      currentEnemy: enemyBestiary.find((e) => e.id === "blood-countess")!,
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 5,
      enemyMaxHealth: 10,
    });
    const enemyHealed = applyEnemyHealingWithCombatText(enemyHealState, 3, []);
    expect(enemyHealed.enemyHealth).toBe(7);
  });
});
