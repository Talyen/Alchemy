import { applyPlayerStatusFromAttack } from "@/lib/battle/status-player";
import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { cardById, enemyBestiary } from "@/lib/game-data";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { BATTLE_CONFIG } from "@/lib/game-constants";
import { makeCombatTexts as makeTexts, patchBattleState } from "../../fixtures/battle";
import { defaultCcState } from "../../fixtures/default-battle-state";

describe("applyEnemyAbility", () => {
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

  it("applies burn status rider on burn damage dealt", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 4 }] }),
      makeTexts(),
    );
    expect(result.playerStatuses.burn).toBe(4);
    expect(result.playerHealth).toBe(26);
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

  it("halves freeze damage and buildup when receiveHalfFreezeDamage talent is active", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      talentEffects: { receiveHalfFreezeDamage: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 10 }] }),
      makeTexts(),
    );

    expect(result.playerHealth).toBe(25);
    expect(result.playerStatuses.freeze).toBe(5);
  });

  it("halves enemy burn damage and burn stacks when receiveHalfBurnDamage is active", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      talentEffects: { receiveHalfBurnDamage: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 4 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(28);
    expect(result.playerStatuses.burn).toBe(2);
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

  it("adds enemy burnBonus to burn damage", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0 },
      enemyStatuses: { burnBonus: 2 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 4 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(24);
  });

  it("adds enemy freezeBonus to freeze damage and buildup", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0 },
      enemyStatuses: { freezeBonus: 2 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 4 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(24);
    expect(result.playerStatuses.freeze).toBe(6);
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

  it("does not heal enemy on lifesteal when freeze blocks regen", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: { freezeBlocksRegen: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5, lifesteal: true }] }),
      makeTexts(),
    );
    expect(result.enemyHealth).toBe(20);
  });

  it("applies player-status attack effects", () => {
    const state = patchBattleState({});
    const result = applyPlayerStatusFromAttack(
      state,
      { kind: "player-status", status: "poison", amount: 2 },
      makeTexts(),
    );
    expect(result.playerStatuses.poison).toBe(2);
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

  it("immediately triggers player stun when incoming buildup reaches threshold", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 20 }] }),
      texts,
    );
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCC.stunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("Grounding prevents stun buildup when the player has block", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 4, armor: 0 },
      talentEffects: { blockPreventsStun: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 8 }] }),
      makeTexts(),
    );
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCC.stunSkipTurns).toBe(0);
  });

  it("Grounding still prevents stun buildup when the hit spends the last Block", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 3, armor: 0 },
      talentEffects: { blockPreventsStun: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 10 }] }),
      makeTexts(),
    );
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCC.stunSkipTurns).toBe(0);
  });

  it("immediately triggers player freeze when incoming buildup reaches threshold", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 20 }] }),
      texts,
    );
    expect(result.playerStatuses.freeze).toBe(0);
    expect(result.playerCC.freezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "freeze", text: "Frozen" });
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

  it("emits actual health gained when block-depleted heal overheals", () => {
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
      amount: 1,
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

  it("banshee purges a single random beneficial status", () => {
    const banshee = enemyBestiary.find((e) => e.id === "banshee")!;
    const stunHit = () => makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 4 }] });

    const onlyBlock = patchBattleState({
      currentEnemy: banshee,
      playerHealth: 30,
      playerStatuses: { block: 10 },
      rng: () => 0.99,
    });
    const blockTexts = makeTexts();
    const purgedBlock = applyEnemyAbility(onlyBlock, stunHit(), blockTexts);
    expect(purgedBlock.playerStatuses.block).toBe(0);
    expect(blockTexts).toContainEqual({ target: "player", kind: "notice", stat: "block", text: "Purged" });

    const crowded = patchBattleState({
      currentEnemy: banshee,
      playerHealth: 30,
      playerStatuses: { block: 10, armor: 2, thorns: 2, forge: 1, haste: 1, phoenixFeather: 1 },
      rng: () => 0.99,
    });
    const crowdedTexts = makeTexts();
    const purgedOne = applyEnemyAbility(crowded, stunHit(), crowdedTexts);
    const purgeNotices = crowdedTexts.filter((text) => text.kind === "notice" && text.text === "Purged");
    expect(purgeNotices).toHaveLength(1);
    const purgedStat = purgeNotices[0]!.stat;
    expect(["block", "armor", "thorns", "forge", "haste", "phoenixFeather"]).toContain(purgedStat);
    expect(purgedOne.playerStatuses[purgedStat as "block"]).toBe(0);
    // Thorns always ends at zero: purged, or consumed by retaliation.
    expect(purgedOne.playerStatuses.thorns).toBe(0);
    if (purgedStat === "block") {
      expect(purgedOne.playerStatuses.block).toBe(0);
    } else {
      // Unpurged Block still absorbs the hit.
      expect(purgedOne.playerStatuses.block).toBeGreaterThan(0);
      expect(purgedOne.playerStatuses.block).toBeLessThan(10);
    }
    for (const stat of ["armor", "forge", "haste", "phoenixFeather"] as const) {
      if (stat !== purgedStat) expect(purgedOne.playerStatuses[stat]).toBe(crowded.playerStatuses[stat]);
    }
  });

  it("banshee purges thorns without retaliation and purges phoenix feather", () => {
    const banshee = enemyBestiary.find((e) => e.id === "banshee")!;
    const physicalHit = () => makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });

    const thorny = patchBattleState({
      currentEnemy: banshee,
      playerHealth: 30,
      enemyHealth: 30,
      playerStatuses: { block: 0, armor: 0, thorns: 3 },
      rng: () => 0.99,
    });
    const thornTexts = makeTexts();
    const purgedThorns = applyEnemyAbility(thorny, physicalHit(), thornTexts);
    expect(purgedThorns.playerStatuses.thorns).toBe(0);
    expect(purgedThorns.enemyHealth).toBe(30);
    expect(thornTexts).toContainEqual({ target: "player", kind: "notice", stat: "thorns", text: "Purged" });

    const feathered = patchBattleState({
      currentEnemy: banshee,
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, phoenixFeather: 1 },
      rng: () => 0.99,
    });
    const featherTexts = makeTexts();
    const purgedFeather = applyEnemyAbility(
      feathered,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 4 }] }),
      featherTexts,
    );
    expect(purgedFeather.playerStatuses.phoenixFeather).toBe(0);
    expect(featherTexts).toContainEqual({
      target: "player",
      kind: "notice",
      stat: "phoenixFeather",
      text: "Purged",
    });
  });

  it("blood-countess damages itself only on actual hero healing", async () => {
    const { applyEnemyHealingWithCombatText, applyHealingWithCombatText } = await import("@/lib/battle/combat-text");
    const countessState = patchBattleState({
      currentEnemy: enemyBestiary.find((e) => e.id === "blood-countess")!,
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 10,
      enemyMaxHealth: 10,
    });
    const healed = applyHealingWithCombatText(countessState, 5, []);
    expect(healed.enemyHealth).toBe(9);
    expect(healed.playerHealth).toBe(25);

    const enemyHealState = patchBattleState({
      currentEnemy: enemyBestiary.find((e) => e.id === "blood-countess")!,
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 5,
      enemyMaxHealth: 10,
    });
    const enemyHealed = applyEnemyHealingWithCombatText(enemyHealState, 3, []);
    expect(enemyHealed.enemyHealth).toBe(8);
  });
});

describe("player Thorns", () => {
  it("fires held thorns back as nature damage when an attack lands and consumes the stack", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, thorns: 3 },
      enemyHealth: 30,
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(25);
    expect(result.enemyHealth).toBe(27);
    expect(result.playerStatuses.thorns).toBe(0);
  });

  it("still fires when block absorbs the hit", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 10, armor: 0, thorns: 2 },
      enemyHealth: 30,
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(5);
    expect(result.enemyHealth).toBe(28);
    expect(result.playerStatuses.thorns).toBe(0);
  });

  it("does not fire when the attack is dodged", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, thorns: 3 },
      enemyHealth: 30,
      rng: () => 0.01,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(30);
    expect(result.enemyHealth).toBe(30);
    expect(result.playerStatuses.thorns).toBe(3);
  });

  it("reports Cold Snap Freeze buildup added by doubling, rather than the multiplier", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 100,
      playerMaxHealth: 100,
      playerStatuses: { freeze: 4 },
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(state, cardById["cold-snap"]!, texts);
    expect(result.playerStatuses.freeze).toBe(10);
    expect(texts).toContainEqual({ target: "player", kind: "multiply", stat: "freeze", amount: 5 });
  });
});
