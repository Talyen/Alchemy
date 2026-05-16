import { describe, expect, it, vi } from "vitest";
import { tickEnemyStatuses, tickPlayerStatuses } from "@/lib/battle/status-ticks";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";

vi.spyOn(Math, "random").mockReturnValue(0.99);

function baseState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    deck: [], hand: [], discard: [], exhausted: [], mana: 4, maxMana: 4, gold: 0,
    turn: 1, turnPhase: "player", playerHealth: 30, playerMaxHealth: 30,
    deathsDoorUsed: false, deathsDoorActive: false, deathsDoorTriggeredTurn: null,
    enemyHealth: 30, enemyMaxHealth: 30, enemyAttackEffects: [], enemyArmor: 0,
    enemyForge: 0, enemyFreezeBonus: 0, enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 },
    enemyStunSkipTurns: 0, enemyFreezeSkipTurns: 0, wishOptions: null, wishQueue: [],
    activeCompanion: null, companionDamageBuff: 0,
    currentEnemy: { id: "skeleton", title: "Skeleton", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [], attackEffects: [] },
    talentEffects: {
      flatPhysicalDamage: 0, armorToPhysicalDamage: false, physicalCritChance: 0,
      firstPhysicalCardFree: false, physicalVsStunnedMultiplier: 0, physicalVsFrozenMultiplier: 0,
      stunThresholdReduction: 0, drawOnStun: 0, nextCardFreeOnStun: false,
      startBlock: 0, blockToPhysicalDamage: false, blockPreventsBleed: false, blockPreventsPoison: false,
      blockPreventsStun: false, blockAbsorbPhysicalBonus: 0,
      forgeToBurn: false, forgeToHoly: false, forgeToBlock: false, forgeBurnThreshold: 0, forgeBurnDamage: 0,
      armorMitigatesBurn: false, armorBlockThreshold: 0, armorBlockAmount: 0, armorDoubledBelowHalfHealth: false,
      firstArmorCardDoubled: false,
      campfireHealBonus: 0, healthThresholdBlock: null, maxHealthPerCombat: 0, startHealth: 0, healMultiplier: 1,
      healthThresholdArmor: null,
      firstBurnCardDoubled: false, burnRemovesEnemyArmor: false, burnDoubleChance: 0, receiveHalfBurnDamage: false,
      shopCardDiscount: 0, shopFreeRefresh: false, startGold: 0, goldPerCombat: 0, potionDiscount: 0,
      potionPotency: 0, potionManaBonus: 0, removeCardDiscount: 0, enemyGoldDropBonus: 0, eliteGoldDropBonus: 0,
      goldOnWish: 0, mixPotionDiscount: 0, companionBondLevels: {},
      holyLifestealPercent: 0, firstHolyCardFree: false, holyGoldPercent: 0, holyBurnChance: 0,
      receiveHalfHolyDamage: false, holyBlockPercent: 0, holyWishChance: 0, holyBlockPercentFromDamage: 0,
      holyVsBurnMultiplier: 0,
      goldOnWishAmount: 0, wishUndiscoveredCards: false, healthOnWish: 0, removeHarmfulStatusOnWish: false,
      wishExtraChoiceChance: 0, wishDrawsCard: false,
      firstPoisonCardFree: false, poisonPhysicalBonus: 0, poisonGainChance: 0, receiveHalfPoisonDamage: false,
      goldOnFirstPoison: 0, poisonHalvesHealing: false, companionDamage: 0, companionGoldFindActive: false,
      firstBleedCardFree: false, bleedPhysicalBonus: 0, bleedLeechChance: 0, bleedEnemyDamageReduction: 0,
      bleedPhysicalTakenBonus: 0, bleedExecuteThreshold: 0, bleedDesperateMultiplier: 1, bleedPoisonChance: 0,
      flatTrapDamage: 0, freezeThresholdReduction: 0, freezeDoubleDamage: false, maxHealthPerCombat: 0,
    },
    trinketEffects: {
      extraDrawPerBattle: 0, firstHolyDamageDoubled: false, firstBurnDoubled: false, boneCharmHealOnKill: 0,
      forgeStunThreshold: 0, forgeStunAmount: 0, frozenHeartDamage: 0, blockToArmorThreshold: 0,
      blockToArmorAmount: 0, runicQuillDrawOnConsume: 0, sinEaterHealOnHarmfulStatusRemove: 0,
      vanguardCrestForgeOnBlockAbsorb: 0, parasiticBloomLeechChance: 0, cutpurseGoldOnBleed: 0,
      wishingWellGoldOnWish: 0, plagueDoctorImmunity: false, mortarPestleFreeFirstPotion: false,
      sunderingArmorPiercing: 0, resonantChimeCardsRequired: 0, resonantChimeMana: 0,
      smugglersMapGoldBonus: 0, grovesFavorStartHeal: 0, merchantsFavorDiscount: 0,
      companionDamageBonus: 0, freezeDurationExtension: 0, thunderstoneDamageOnStun: 0,
      luckyCloverGoldChance: 0,
    },
    flags: {
      firstPhysicalCardFreeUsed: false, firstHolyCardFreeUsed: false, firstBurnCardDoubledUsed: false,
      firstArmorCardDoubledUsed: false, firstPoisonCardFreeUsed: false, firstBleedCardFreeUsed: false,
      nextCardCostReduction: 0, goldOnFirstPoisonThisCombat: false, firstHolyDamageBonusUsed: false,
      firstBurnTrinketDoubledUsed: false, firstHarmfulStatusPrevented: false, firstPotionFreeUsed: false,
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
      enemyStatuses: { ...baseState().enemyStatuses, bleed: 6, bleedLeech: 0 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(24);
    expect(next.enemyStatuses.bleed).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 6 });
  });

  it("heals player from bleedLeech", () => {
    const state = baseState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: { ...baseState().enemyStatuses, bleed: 6, bleedLeech: 3 },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.playerHealth).toBe(23);
    expect(next.enemyStatuses.bleedLeech).toBe(0);
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
      enemyStatuses: { ...baseState().enemyStatuses, burn: 10, poison: 5, bleed: 8, bleedLeech: 2 },
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
        id: "fire-elemental", title: "Fire Elemental", subtitle: "", descriptionLines: [""], art: "",
        enemyType: "normal", traits: [{ id: "burn-resistance", title: "Burn Resistance", description: "Half burn damage" }],
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
    expect(next.playerStatuses.burn).toBe(1);
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

  it("deals stun damage and clears stun", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, stun: 4 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(26);
    expect(next.playerStatuses.stun).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "stun", amount: 4 });
  });

  it("deals freeze damage and clears freeze", () => {
    const state = baseState({
      playerHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, freeze: 3 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(27);
    expect(next.playerStatuses.freeze).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "freeze", amount: 3 });
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
    expect(next.playerHealth).toBe(28);
    expect(next.playerStatuses.burn).toBe(4);
    expect(next.playerStatuses.poison).toBe(3);
    expect(next.playerStatuses.bleed).toBe(0);
    expect(next.playerStatuses.stun).toBe(0);
    expect(next.playerStatuses.freeze).toBe(0);
  });
});
