import { describe, expect, it } from "vitest";
import { tickEnemyStatuses, tickPlayerStatuses } from "@/lib/battle/status-ticks";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";

function makeTexts(): CombatTextEvent[] {
  return [];
}

describe("tickEnemyStatuses", () => {
  it("deals burn damage and halves burn stack", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, burn: 10 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(20);
    expect(next.enemyStatuses.burn).toBe(5);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 10 });
  });

  it("fully clears enemy burn at 1 stack", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, burn: 1 },
    });
    const next = tickEnemyStatuses(state, makeTexts());
    expect(next.enemyHealth).toBe(29);
    expect(next.enemyStatuses.burn).toBe(0);
  });

  it("deals poison damage and decays poison by 1", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, poison: 8 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(22);
    expect(next.enemyStatuses.poison).toBe(7);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: 8 });
  });

  it("deals bleed damage equal to stack and resets bleed to 0", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, bleed: 6 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(24);
    expect(next.enemyStatuses.bleed).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 6 });
  });

  it("heals player from pending bleed leech healing", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, bleed: 6 },
      pendingBleedLeechHealing: 3,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.playerHealth).toBe(23);
    expect(next.pendingBleedLeechHealing).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
  });

  it("skips tick when burn is 0", () => {
    const state = createTestBattleState();
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(30);
    expect(texts).toEqual([]);
  });

  it("applies all DoTs in sequence", () => {
    const state = createTestBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, burn: 10, poison: 5, bleed: 8 },
      pendingBleedLeechHealing: 2,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(27);
    expect(next.enemyStatuses.burn).toBe(5);
    expect(next.enemyStatuses.poison).toBe(4);
    expect(next.enemyStatuses.bleed).toBe(0);
  });

  it("applies burn damage before any CC logic runs on player ticks", () => {
    const state = createTestBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 8, stun: 20 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(12);
    expect(next.playerStunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 8 });
  });

  it("burnDoubleChance doubles burn when triggered", () => {
    const state = createTestBattleState({
      enemyStatuses: { ...createTestBattleState().enemyStatuses, burn: 10 },
      talentEffects: { ...createTestBattleState().talentEffects, burnDoubleChance: 50 },
      rng: () => 0.01,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyStatuses.burn).toBe(20);
  });

  it("poisonGainChance increases poison when triggered", () => {
    const state = createTestBattleState({
      enemyStatuses: { ...createTestBattleState().enemyStatuses, poison: 5 },
      talentEffects: { ...createTestBattleState().talentEffects, poisonGainChance: 50 },
      rng: () => 0.01,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyStatuses.poison).toBe(6);
  });

  it("parasiticBloomLeechChance heals player on poison tick", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, poison: 8 },
      trinketEffects: { ...createTestBattleState().trinketEffects, parasiticBloomLeechChance: 50 },
      rng: () => 0.01,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(22);
    expect(next.playerHealth).toBe(28);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 8 });
  });

  it("clamps enemy health at 0", () => {
    const state = createTestBattleState({
      enemyHealth: 3,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, burn: 10 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(0);
  });

  it("applies resistance multiplier for burn", () => {
    const state = createTestBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, burn: 10 },
      currentEnemy: {
        id: "fire-elemental",
        title: "Fire Elemental",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "burn-resistance", title: "Burn Resistance", description: "Half burn damage" }],
        attackEffects: [],
      },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(45);
  });

  it("applies vulnerability multiplier for burn", () => {
    const state = createTestBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, burn: 10 },
      currentEnemy: {
        id: "blight-treant",
        title: "The Blight Treant",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "boss",
        traits: [{ id: "burn-vulnerability", title: "Burn Vulnerability", description: "Receives double Burn damage" }],
        attackEffects: [],
      },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    // 10 burn damage * 2 (weakness multiplier) = 20 damage. Health: 50 -> 30.
    expect(next.enemyHealth).toBe(30);
  });
});

describe("tickPlayerStatuses", () => {
  it("deals burn damage to player and halves burn", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 8 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(22);
    expect(next.playerStatuses.burn).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 8 });
  });

  it("fully clears player burn at 1 stack", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 1 },
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerHealth).toBe(29);
    expect(next.playerStatuses.burn).toBe(0);
  });

  it("receiveHalfBurnDamage halves burn damage", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 8 },
      talentEffects: { ...createTestBattleState().talentEffects, receiveHalfBurnDamage: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 4 });
  });

  it("armorMitigatesBurn reduces burn damage by armor", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 8, armor: 3 },
      talentEffects: { ...createTestBattleState().talentEffects, armorMitigatesBurn: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(25);
    expect(next.playerStatuses.armor).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 5 });
  });

  it("armorMitigatesBurn with high armor results in 0 damage", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 3, armor: 10 },
      talentEffects: { ...createTestBattleState().talentEffects, armorMitigatesBurn: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.armor).toBe(10);
    expect(next.playerStatuses.burn).toBe(2);
  });

  it("blockReduceBurnDamage reduces burn damage when block is active", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 8, block: 5 },
      talentEffects: { ...createTestBattleState().talentEffects, blockReduceBurnDamage: 1 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(23);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 7 });
  });

  it("blockReduceBurnDamage reduces burn to 0 when block is active and damage is 1", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 1, block: 5 },
      talentEffects: { ...createTestBattleState().talentEffects, blockReduceBurnDamage: 1 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.burn).toBe(0);
  });

  it("blockReduceBurnDamage does nothing when block is 0", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 8, block: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, blockReduceBurnDamage: 1 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(22);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 8 });
  });

  it("blockReduceBurnDamage stacks with armorMitigatesBurn", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 8, block: 5, armor: 3 },
      talentEffects: { ...createTestBattleState().talentEffects, blockReduceBurnDamage: 1, armorMitigatesBurn: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    // block reduces: 8 -> 7, armor reduces: 7 -> 4
    expect(next.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 4 });
  });

  it("deals poison damage to player and decrements poison", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, poison: 5 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(25);
    expect(next.playerStatuses.poison).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "poison", amount: 5 });
  });

  it("receiveHalfPoisonDamage halves poison damage", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, poison: 8 },
      talentEffects: { ...createTestBattleState().talentEffects, receiveHalfPoisonDamage: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "poison", amount: 4 });
  });

  it("deals bleed damage and clears bleed", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, bleed: 7 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(23);
    expect(next.playerStatuses.bleed).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "bleed", amount: 7 });
  });

  it("clears stun and triggers turn skip when threshold exceeded", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, stun: 20 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    // Stun threshold: 30 * 0.5 = 15, stun is 20 > 15, so triggers.
    expect(next.playerHealth).toBe(30); // no damage from stun
    expect(next.playerStatuses.stun).toBe(0);
    expect(next.playerStunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("does not apply offensive stun talents to player stun triggers", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, stun: 14 },
      talentEffects: { ...createTestBattleState().talentEffects, stunThresholdReduction: 0.25, stunDurationExtension: 2 },
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerStunSkipTurns).toBe(0);
    expect(next.playerStatuses.stun).toBe(14);
  });

  it("does not trigger stun skip when stun is below threshold", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, stun: 5 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.stun).toBe(5); // unchanged, below threshold
    expect(next.playerStunSkipTurns).toBe(0);
  });

  it("clears freeze and triggers turn skip when threshold exceeded", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, freeze: 30 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    // Freeze threshold: 30 * 0.5 = 15, freeze is 30 >= 15, so triggers.
    expect(next.playerHealth).toBe(30); // no damage from freeze
    expect(next.playerStatuses.freeze).toBe(0);
    expect(next.playerFreezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "freeze", text: "Frozen" });
  });

  it("does not apply offensive freeze duration bonuses to player freeze triggers", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, freeze: 30 },
      trinketEffects: { ...createTestBattleState().trinketEffects, freezeDurationExtension: 2 },
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerFreezeSkipTurns).toBe(1);
  });

  it("CC immunity suppresses second stun trigger within cooldown", () => {
    // First trigger: stun exceeds threshold, sets skip + cooldown.
    const state = createTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, stun: 20 },
    });
    const texts = makeTexts();
    const afterFirst = tickPlayerStatuses(state, texts);
    expect(afterFirst.playerStunSkipTurns).toBe(1);
    expect(afterFirst.playerCCCooldown).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });

    // Second trigger: cooldown active, stun cleared silently, no extra skip.
    const texts2 = makeTexts();
    const afterSecond = tickPlayerStatuses(afterFirst, texts2);
    expect(afterSecond.playerStunSkipTurns).toBe(1); // unchanged
    expect(afterSecond.playerStatuses.stun).toBe(0);
    expect(texts2).not.toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("CC immunity cooldown expires and allows another stun", () => {
    // Trigger stun, tick down cooldown to 1, then 0, then trigger again.
    const state = createTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, stun: 20 },
    });
    const texts = makeTexts();
    const afterTrigger = tickPlayerStatuses(state, texts);
    expect(afterTrigger.playerCCCooldown).toBe(2);

    // Simulate two turn advances by manually decrementing cooldown to 0.
    const cooledDown = {
      ...afterTrigger,
      playerCCCooldown: 0,
      playerStatuses: { ...afterTrigger.playerStatuses, stun: 20 },
    };
    const texts3 = makeTexts();
    const afterReTrigger = tickPlayerStatuses(cooledDown, texts3);
    expect(afterReTrigger.playerStunSkipTurns).toBe(2); // triggered again
    expect(afterReTrigger.playerCCCooldown).toBe(2); // refreshed
  });

  it("skips ticks when all statuses are 0", () => {
    const state = createTestBattleState();
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(texts).toEqual([]);
  });

  it("applies all player DoTs in sequence", () => {
    const state = createTestBattleState({
      playerHealth: 50,
      playerMaxHealth: 50,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 8, poison: 4, bleed: 5, stun: 3, freeze: 2 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    // burn: 8 damage (no receiveHalfBurnDamage talent), decays to 4.
    // poison: 4 damage, decays to 3. bleed: 5 damage, cleared to 0.
    // stun and freeze: below threshold, no damage, unchanged.
    expect(next.playerHealth).toBe(33);
    expect(next.playerStatuses.burn).toBe(4);
    expect(next.playerStatuses.poison).toBe(3);
    expect(next.playerStatuses.bleed).toBe(0);
    expect(next.playerStatuses.stun).toBe(3); // below threshold (50*0.5=25), unchanged
    expect(next.playerStatuses.freeze).toBe(2); // below threshold, unchanged
  });
});
