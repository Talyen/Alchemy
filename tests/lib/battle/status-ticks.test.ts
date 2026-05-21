import { describe, expect, it, vi } from "vitest";
import { tickEnemyStatuses, tickPlayerStatuses } from "@/lib/battle/status-ticks";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";

vi.spyOn(Math, "random").mockReturnValue(0.99);

function baseState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    deck: [],
    hand: [],
    discard: [],
    exhausted: [],
    mana: 4,
    maxMana: 4,
    gold: 0,
    turn: 1,
    turnPhase: "player",
    playerHealth: 30,
    playerMaxHealth: 30,
    deathsDoorUsed: false,
    deathsDoorActive: false,
    deathsDoorTriggeredTurn: null,
    enemyHealth: 30,
    enemyMaxHealth: 30,
    enemyAttackEffects: [],
    enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0 },
    enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    pendingBleedLeechHealing: 0,
    enemyStunSkipTurns: 0,
    enemyFreezeSkipTurns: 0,
    playerStunSkipTurns: 0,
    playerFreezeSkipTurns: 0,
    wishOptions: null,
    wishQueue: [],
    activeCompanion: null,
    companionDamageBuff: 0,
    currentEnemy: {
      id: "skeleton",
      title: "Skeleton",
      subtitle: "",
      descriptionLines: [""],
      art: "",
      enemyType: "normal",
      traits: [],
      attackEffects: [],
    },
    talentEffects: {
      flatPhysicalDamage: 0,
      armorToPhysicalDamage: false,
      physicalCritChance: 0,
      firstPhysicalCardFree: false,
      physicalVsStunnedMultiplier: 0,
      physicalVsFrozenMultiplier: 0,
      stunThresholdReduction: 0,
      drawOnStun: 0,
      nextCardFreeOnStun: false,
      stunDurationExtension: 0,
      stunDoubleDamage: false,
      flatStunDamage: 0,
      blockOnStun: 0,
      forgeOnStun: 0,
      stunStripArmor: false,
      manaOnStun: 0,
      startBlock: 0,
      blockToPhysicalDamage: false,
      blockPreventsBleed: false,
      blockPreventsPoison: false,
      blockPreventsStun: false,
      blockAbsorbPhysicalBonus: 0,
      blockReduceBurnDamage: 0,
      blockDepletedHeal: 0,
      blockToHolyDamage: false,
      blockToStunDamage: false,
      forgeToBurn: false,
      forgeToHoly: false,
      forgeToBlock: false,
      forgeToBleed: false,
      forgeBurnThreshold: 0,
      forgeBurnDamage: 0,
      startForge: 0,
      forgeStripArmorThreshold: 0,
      flatForgeGained: 0,
      forgeDoubledBelowHalfHealth: false,
      forgeBlockThreshold: 0,
      forgeBlockAmount: 0,
      armorMitigatesBurn: false,
      armorBlockThreshold: 0,
      armorBlockAmount: 0,
      armorDoubledBelowHalfHealth: false,
      firstArmorCardDoubled: false,
      startArmor: 0,
      armorMitigatesBleed: false,
      armorBreakBlock: 0,
      armorMitigatesStun: false,
      armorCleanseThreshold: 0,
      flatArmorAmount: 0,
      campfireHealBonus: 0,
      healthThresholdBlock: null,
      maxHealthPerCombat: 0,
      startHealth: 0,
      healMultiplier: 1,
      healthThresholdArmor: null,
      firstBurnCardDoubled: false,
      burnRemovesEnemyArmor: false,
      burnDoubleChance: 0,
      receiveHalfBurnDamage: false,
      shopCardDiscount: 0,
      shopFreeRefresh: false,
      startGold: 0,
      goldPerCombat: 0,
      potionDiscount: 0,
      potionPotency: 0,
      removeCardDiscount: 0,
      enemyGoldDropBonus: 0,
      eliteGoldDropBonus: 0,
      goldOnWish: 0,
      mixPotionDiscount: 0,
      companionBondLevels: {},
      holyLifestealPercent: 0,
      firstHolyCardFree: false,
      holyGoldPercent: 0,
      holyBurnChance: 0,
      receiveHalfHolyDamage: false,
      holyBlockPercent: 0,
      holyWishChance: 0,
      holyBlockPercentFromDamage: 0,
      holyVsBurnMultiplier: 0,
      goldOnWishAmount: 0,
      wishUndiscoveredCards: false,
      healthOnWish: 0,
      removeHarmfulStatusOnWish: false,
      wishExtraChoiceChance: 0,
      wishDrawsCard: false,
      firstPoisonCardFree: false,
      poisonPhysicalBonus: 0,
      poisonGainChance: 0,
      receiveHalfPoisonDamage: false,
      goldOnFirstPoison: 0,
      poisonHalvesHealing: false,
      companionDamage: 0,
      companionGoldFindActive: false,
      firstBleedCardFree: false,
      bleedPhysicalBonus: 0,
      bleedLeechChance: 0,
      bleedEnemyDamageReduction: 0,
      bleedPhysicalTakenBonus: 0,
      bleedExecuteThreshold: 0,
      bleedDesperateMultiplier: 1,
      bleedPoisonChance: 0,
      flatTrapDamage: 0,
      freezeThresholdReduction: 0,
      freezeDoubleDamage: false,
      maxHealthPerCombat: 0,
    },
    trinketEffects: {
      extraDrawPerBattle: 0,
      firstHolyDamageDoubled: false,
      firstBurnDoubled: false,
      boneCharmHealOnKill: 0,
      forgeStunThreshold: 0,
      forgeStunAmount: 0,
      frozenHeartDamage: 0,
      blockToArmorThreshold: 0,
      blockToArmorAmount: 0,
      runicQuillDrawOnConsume: 0,
      sinEaterHealOnHarmfulStatusRemove: 0,
      vanguardCrestForgeOnBlockAbsorb: 0,
      parasiticBloomLeechChance: 0,
      cutpurseGoldOnBleed: 0,
      wishingWellGoldOnWish: 0,
      plagueDoctorImmunity: false,
      mortarPestleFreeFirstPotion: false,
      sunderingArmorPiercing: 0,
      resonantChimeCardsRequired: 0,
      resonantChimeMana: 0,
      smugglersMapGoldBonus: 0,
      grovesFavorStartHeal: 0,
      merchantsFavorDiscount: 0,
      companionDamageBonus: 0,
      freezeDurationExtension: 0,
      thunderstoneDamageOnStun: 0,
      luckyCloverGoldChance: 0,
    },
    flags: {
      firstPhysicalCardFreeUsed: false,
      firstHolyCardFreeUsed: false,
      firstBurnCardDoubledUsed: false,
      firstArmorCardDoubledUsed: false,
      firstPoisonCardFreeUsed: false,
      firstBleedCardFreeUsed: false,
      nextCardCostReduction: 0,
      goldOnFirstPoisonThisCombat: false,
      firstHolyDamageBonusUsed: false,
      firstBurnTrinketDoubledUsed: false,
      firstHarmfulStatusPrevented: false,
      firstPotionFreeUsed: false,
      resonantChimeUsedThisTurn: false,
    },
    discoveredCardIds: [],
    cardsPlayedThisTurn: 0,
    nextCardUid: 0,
    difficultyModifiers: [],
    ...overrides,
  };
}

function makeTexts(): CombatTextEvent[] {
  return [];
}

describe("tickEnemyStatuses", () => {
  it("deals burn damage and halves burn stack", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyStatuses: { ...baseState().enemyStatuses, burn: 10 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(20);
    expect(next.enemyStatuses.burn).toBe(5);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 10 });
  });

  it("fully clears enemy burn at 1 stack", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyStatuses: { ...baseState().enemyStatuses, burn: 1 },
    });
    const next = tickEnemyStatuses(state, makeTexts());
    expect(next.enemyHealth).toBe(29);
    expect(next.enemyStatuses.burn).toBe(0);
  });

  it("deals poison damage and decays poison by 1", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyStatuses: { ...baseState().enemyStatuses, poison: 8 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(22);
    expect(next.enemyStatuses.poison).toBe(7);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: 8 });
  });

  it("deals bleed damage equal to stack and resets bleed to 0", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyStatuses: { ...baseState().enemyStatuses, bleed: 6 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(24);
    expect(next.enemyStatuses.bleed).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 6 });
  });

  it("heals player from pending bleed leech healing", () => {
    const state = baseState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: { ...baseState().enemyStatuses, bleed: 6 },
      pendingBleedLeechHealing: 3,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.playerHealth).toBe(23);
    expect(next.pendingBleedLeechHealing).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
  });

  it("skips tick when burn is 0", () => {
    const state = baseState();
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(30);
    expect(texts).toEqual([]);
  });

  it("applies all DoTs in sequence", () => {
    const state = baseState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: { ...baseState().enemyStatuses, burn: 10, poison: 5, bleed: 8 },
      pendingBleedLeechHealing: 2,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(27);
    expect(next.enemyStatuses.burn).toBe(5);
    expect(next.enemyStatuses.poison).toBe(4);
    expect(next.enemyStatuses.bleed).toBe(0);
  });

  it("burnDoubleChance doubles burn when triggered", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.01);
    const state = baseState({
      enemyStatuses: { ...baseState().enemyStatuses, burn: 10 },
      talentEffects: { ...baseState().talentEffects, burnDoubleChance: 50 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyStatuses.burn).toBe(20);
  });

  it("poisonGainChance increases poison when triggered", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.01);
    const state = baseState({
      enemyStatuses: { ...baseState().enemyStatuses, poison: 5 },
      talentEffects: { ...baseState().talentEffects, poisonGainChance: 50 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyStatuses.poison).toBe(6);
  });

  it("parasiticBloomLeechChance heals player on poison tick", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.01);
    const state = baseState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: { ...baseState().enemyStatuses, poison: 8 },
      trinketEffects: { ...baseState().trinketEffects, parasiticBloomLeechChance: 50 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(22);
    expect(next.playerHealth).toBe(28);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 8 });
  });

  it("clamps enemy health at 0", () => {
    const state = baseState({
      enemyHealth: 3,
      enemyStatuses: { ...baseState().enemyStatuses, burn: 10 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(0);
  });

  it("applies resistance multiplier for burn", () => {
    const state = baseState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: { ...baseState().enemyStatuses, burn: 10 },
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
});

describe("tickPlayerStatuses", () => {
  it("deals burn damage to player and halves burn", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, burn: 8 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(22);
    expect(next.playerStatuses.burn).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 8 });
  });

  it("fully clears player burn at 1 stack", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, burn: 1 },
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerHealth).toBe(29);
    expect(next.playerStatuses.burn).toBe(0);
  });

  it("receiveHalfBurnDamage halves burn damage", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, burn: 8 },
      talentEffects: { ...baseState().talentEffects, receiveHalfBurnDamage: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 4 });
  });

  it("armorMitigatesBurn reduces burn damage by armor", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, burn: 8, armor: 3 },
      talentEffects: { ...baseState().talentEffects, armorMitigatesBurn: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(25);
    expect(next.playerStatuses.armor).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 5 });
  });

  it("armorMitigatesBurn with high armor results in 0 damage", () => {
    const state = baseState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, burn: 3, armor: 10 },
      talentEffects: { ...baseState().talentEffects, armorMitigatesBurn: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.armor).toBe(10);
    expect(next.playerStatuses.burn).toBe(2);
  });

  it("blockReduceBurnDamage reduces burn damage when block is active", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, burn: 8, block: 5 },
      talentEffects: { ...baseState().talentEffects, blockReduceBurnDamage: 1 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(23);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 7 });
  });

  it("blockReduceBurnDamage reduces burn to 0 when block is active and damage is 1", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, burn: 1, block: 5 },
      talentEffects: { ...baseState().talentEffects, blockReduceBurnDamage: 1 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.burn).toBe(0);
  });

  it("blockReduceBurnDamage does nothing when block is 0", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, burn: 8, block: 0 },
      talentEffects: { ...baseState().talentEffects, blockReduceBurnDamage: 1 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(22);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 8 });
  });

  it("blockReduceBurnDamage stacks with armorMitigatesBurn", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, burn: 8, block: 5, armor: 3 },
      talentEffects: { ...baseState().talentEffects, blockReduceBurnDamage: 1, armorMitigatesBurn: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    // block reduces: 8 -> 7, armor reduces: 7 -> 4
    expect(next.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 4 });
  });

  it("deals poison damage to player and decrements poison", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, poison: 5 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(25);
    expect(next.playerStatuses.poison).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "poison", amount: 5 });
  });

  it("receiveHalfPoisonDamage halves poison damage", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, poison: 8 },
      talentEffects: { ...baseState().talentEffects, receiveHalfPoisonDamage: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "poison", amount: 4 });
  });

  it("deals bleed damage and clears bleed", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, bleed: 7 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(23);
    expect(next.playerStatuses.bleed).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "bleed", amount: 7 });
  });

  it("clears stun and triggers turn skip when threshold exceeded", () => {
    const state = baseState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, stun: 20 },
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
    const state = baseState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, stun: 14 },
      talentEffects: { ...baseState().talentEffects, stunThresholdReduction: 0.25, stunDurationExtension: 2 },
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerStunSkipTurns).toBe(0);
    expect(next.playerStatuses.stun).toBe(14);
  });

  it("does not trigger stun skip when stun is below threshold", () => {
    const state = baseState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, stun: 5 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.stun).toBe(5); // unchanged, below threshold
    expect(next.playerStunSkipTurns).toBe(0);
  });

  it("clears freeze and triggers turn skip when threshold exceeded", () => {
    const state = baseState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, freeze: 30 },
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
    const state = baseState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, freeze: 30 },
      trinketEffects: { ...baseState().trinketEffects, freezeDurationExtension: 2 },
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerFreezeSkipTurns).toBe(1);
  });

  it("CC immunity suppresses second stun trigger within cooldown", () => {
    // First trigger: stun exceeds threshold, sets skip + cooldown.
    const state = baseState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, stun: 20 },
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
    const state = baseState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, stun: 20 },
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
    const state = baseState();
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(texts).toEqual([]);
  });

  it("applies all player DoTs in sequence", () => {
    const state = baseState({
      playerHealth: 50,
      playerMaxHealth: 50,
      playerStatuses: { ...baseState().playerStatuses, burn: 8, poison: 4, bleed: 5, stun: 3, freeze: 2 },
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
