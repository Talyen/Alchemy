import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { applyPlayerStatusFromAttack } from "@/lib/battle/status-player";
import { BATTLE_CONFIG } from "@/lib/game-constants";
import { describe, expect, it } from "vitest";
import { makeCombatTexts as makeTexts, patchBattleState } from "../../fixtures/battle";
import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";

describe("applyEnemyAbility: attack", () => {
  it("player block absorbs before health", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 10, armor: 0 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      makeTexts(),
    );
    expect(result.playerStatuses.block).toBe(5);
    expect(result.playerHealth).toBe(30);
  });

  it("applies enemy forge bonus to physical damage", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      enemyMitigation: { forge: 3 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(22);
  });

  it("triggers Death's Door fields when attack is lethal", () => {
    const state = patchBattleState({
      playerHealth: 5,
      playerStatuses: { block: 0, armor: 0 },
      deathsDoorUsed: false,
      turn: 3,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(1);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.deathsDoorActive).toBe(true);
    expect(result.deathsDoorTriggeredTurn).toBe(3);
  });

  it("player armor reduces physical damage before health", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 3 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(25);
  });

  it("halves holy damage when receiveHalfHolyDamage talent is active", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      talentEffects: { receiveHalfHolyDamage: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 10 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(25);
  });

  it("halves enemy nature damage when receiveHalfNatureDamage is active", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      talentEffects: { receiveHalfNatureDamage: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "nature", amount: 10 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(25);
  });

  it("reduces incoming damage when enemy is poisoned and poisonReducesEnemyDamage is active", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      enemyStatuses: { poison: 3 },
      talentEffects: { poisonReducesEnemyDamage: 2 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 7 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(25);
  });

  it("increases block absorption for physical hits with blockAbsorbPhysicalBonus", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 10, armor: 0 },
      talentEffects: { blockAbsorbPhysicalBonus: 20 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 11 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(2);
  });

  it("decays player armor when health damage is taken", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 3 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      makeTexts(),
    );
    expect(result.playerStatuses.armor).toBe(3 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
  });

  it("grants block when armor breaks with armorBreakBlock talent", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 1 },
      talentEffects: { armorBreakBlock: 5 },
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      texts,
    );
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.playerStatuses.block).toBe(5);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 5 });
  });

  it("decays enemy forge after dealing physical health damage", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      enemyMitigation: { forge: 3 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
      makeTexts(),
    );
    expect(result.enemyMitigation.forge).toBe(3 - BATTLE_CONFIG.FORGE_DECAY_AMOUNT);
  });

  it("heals enemy for half damage on lifesteal attacks", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      enemyHealth: 20,
      enemyMaxHealth: 30,
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5, lifesteal: true }] }),
      texts,
    );
    expect(result.enemyHealth).toBe(23);
    expect(texts).toContainEqual({ target: "enemy", kind: "heal", stat: "health", amount: 3 });
  });

  it("does not heal enemy on lifesteal when blockEnemyLeech talent is active", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      enemyHealth: 20,
      enemyMaxHealth: 30,
      talentEffects: { blockEnemyLeech: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5, lifesteal: true }] }),
      makeTexts(),
    );
    expect(result.enemyHealth).toBe(20);
  });

  it("armor reduces Stun ability damage", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 3 },
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 5 }] }),
      texts,
    );
    expect(result.playerHealth).toBe(28);
    expect(result.playerStatuses.stun).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "stun", amount: 2 });
  });

  it("grants forge from vanguard crest when block fully absorbs the attack", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 10, armor: 0 },
      trinketEffects: { vanguardCrestForgeOnBlockAbsorb: 2 },
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      texts,
    );
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.forge).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 2 });
  });

  it("heals player when block is depleted with blockDepletedHeal talent", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerStatuses: { block: 2, armor: 0 },
      talentEffects: { blockDepletedHeal: 3 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(15);
  });

  it("emits full healing potency when block-depleted heal overheals", () => {
    const texts = makeTexts();
    const state = patchBattleState({
      playerHealth: 29,
      playerMaxHealth: 30,
      playerStatuses: { block: 5, armor: 0 },
      talentEffects: { blockDepletedHeal: 4 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      texts,
    );
    expect(result.playerHealth).toBe(30);
    expect(texts.find((t) => t.kind === "heal")).toEqual({
      target: "player",
      kind: "heal",
      stat: "health",
      amount: 4,
    });
  });

  it("consumes phoenix feather and resurrects player when attack is lethal", () => {
    const state = patchBattleState({
      playerHealth: 5,
      playerMaxHealth: 30,
      playerStatuses: {
        block: 0,
        armor: 0,
        phoenixFeather: 1,
      },
      deathsDoorUsed: false,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] }),
      makeTexts(),
    );

    expect(result.playerHealth).toBe(9);
    expect(result.playerStatuses.phoenixFeather).toBe(0);
    expect(result.deathsDoorUsed).toBe(false);
    expect(result.deathsDoorActive).toBe(false);
  });

  it("Dodges an enemy damage packet before Block and Armor", () => {
    const texts = makeTexts();
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 10, armor: 5 },
      rng: () => 0.01,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      texts,
    );
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
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, poison: 0 },
      rng: () => 0.01,
    });
    const result = applyPlayerStatusFromAttack(
      state,
      { kind: "player-status", status: "poison", amount: 4 },
      makeTexts(),
    );
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.poison).toBe(4);
  });

  it("does not Dodge encounter-style damage that omits canDodge", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      rng: () => 0.01,
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 8 }, makeTexts());
    expect(result.playerHealth).toBeLessThan(30);
  });
});
