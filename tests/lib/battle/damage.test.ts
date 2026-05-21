import { describe, expect, it, vi, afterEach } from "vitest";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";
import type { BattleCardEffect, BattleCard } from "@/lib/game-data";
import { CRIT_MULTIPLIER, GOLD_TROVE_DAMAGE_REWARD } from "@/lib/game-constants";

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
    enemyArmor: 0,
    enemyForge: 0,
    enemyFreezeBonus: 0,
    enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    pendingBleedLeechHealing: 0,
    enemyStunSkipTurns: 0,
    enemyFreezeSkipTurns: 0,
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
      forgeToBurn: false,
      forgeToHoly: false,
      forgeToBlock: false,
      forgeBurnThreshold: 0,
      forgeBurnDamage: 0,
      armorMitigatesBurn: false,
      armorBlockThreshold: 0,
      armorBlockAmount: 0,
      armorDoubledBelowHalfHealth: false,
      firstArmorCardDoubled: false,
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

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test",
    title: "Test",
    descriptionLines: [""],
    art: "",
    cost: 1,
    effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    ...overrides,
  };
}

function makeEffect(damageType: string, amount: number, extras: Partial<BattleCardEffect> = {}): BattleCardEffect {
  return {
    kind: "damage",
    damageType: damageType as BattleCardEffect["damageType"],
    amount,
    ...extras,
  } as BattleCardEffect;
}

function makeTexts(): CombatTextEvent[] {
  return [];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dealDamageToEnemy — basic physical damage", () => {
  it("deals base damage to enemy health", () => {
    const state = baseState({ enemyHealth: 30 });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      makeTexts(),
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("produces combat text for damage", () => {
    const state = baseState({ enemyHealth: 30 });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    dealDamageToEnemy(state, card, card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>, texts);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.target === "enemy" && t.kind === "damage")).toBe(true);
  });
});

describe("computeBaseDamage — forge bonus", () => {
  it("adds forge bonus to physical damage", () => {
    const state = baseState({ playerStatuses: { ...baseState().playerStatuses, forge: 3 } });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2); // forge consumed
  });

  it("adds forge to burn when forgeToBurn talent is active", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 2 },
      talentEffects: { ...baseState().talentEffects, forgeToBurn: true },
    });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("adds forge to holy when forgeToHoly talent is active", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 2 },
      talentEffects: { ...baseState().talentEffects, forgeToHoly: true },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });
});

describe("computeBaseDamage — equalToBlock / equalToArmor", () => {
  it("damage equals block plus forge when equalToBlock", () => {
    const state = baseState({ playerStatuses: { ...baseState().playerStatuses, block: 7 } });
    const card = makeCard({ effects: [makeEffect("physical", 0, { equalToBlock: true })] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThanOrEqual(30 - 7);
  });

  it("damage equals armor plus forge when equalToArmor", () => {
    const state = baseState({ playerStatuses: { ...baseState().playerStatuses, armor: 4 } });
    const card = makeCard({ effects: [makeEffect("physical", 0, { equalToArmor: true })] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThanOrEqual(30 - 4);
  });
});

describe("computeBaseDamage — holy damage", () => {
  it("scales holy damage with gold when holyGoldPercent is active", () => {
    const state = baseState({
      gold: 50,
      talentEffects: { ...baseState().talentEffects, holyGoldPercent: 10 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("scales holy damage with block when holyBlockPercent is active", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, block: 10 },
      talentEffects: { ...baseState().talentEffects, holyBlockPercent: 20 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("amplifies holy damage against burning enemies with holyVsBurnMultiplier", () => {
    const state = baseState({
      enemyStatuses: { ...baseState().enemyStatuses, burn: 5 },
      talentEffects: { ...baseState().talentEffects, holyVsBurnMultiplier: 0.5 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });
});

describe("computeBaseDamage — bleed damage", () => {
  it("applies bleed desperate multiplier when player below half health", () => {
    const state = baseState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...baseState().talentEffects, bleedDesperateMultiplier: 1.5 },
    });
    const card = makeCard({ effects: [makeEffect("bleed", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30);
  });

  it("applies bleed execute threshold multiplier", () => {
    const state = baseState({
      enemyHealth: 5,
      enemyMaxHealth: 30,
      talentEffects: { ...baseState().talentEffects, bleedExecuteThreshold: 25 },
    });
    const card = makeCard({ effects: [makeEffect("bleed", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(0);
  });
});

describe("computeBaseDamage — trap damage", () => {
  it("adds flatTrapDamage to trap damage type", () => {
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, flatTrapDamage: 3 },
    });
    const card = makeCard({ effects: [makeEffect("trap", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(25);
  });
});

describe("computeBaseDamage — stun damage", () => {
  it("adds flatStunDamage to stun damage type", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, flatStunDamage: 2 },
    });
    const card = makeCard({ effects: [makeEffect("stun", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 5 base + 2 flat = 7 damage, no armor for stun
    expect(result.enemyHealth).toBe(23);
  });
});

describe("computeBaseDamage — physical vs statuses", () => {
  it("adds poisonPhysicalBonus against poisoned enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({
      enemyStatuses: { ...baseState().enemyStatuses, poison: 5 },
      talentEffects: { ...baseState().talentEffects, poisonPhysicalBonus: 3 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 5 base + 3 poison bonus = 8 damage, no armor
    expect(result.enemyHealth).toBe(22);
  });

  it("adds bleedPhysicalBonus against bleeding enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({
      enemyStatuses: { ...baseState().enemyStatuses, bleed: 5 },
      talentEffects: { ...baseState().talentEffects, bleedPhysicalBonus: 2, bleedPhysicalTakenBonus: 1 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 5 base + 2 bleed + 1 bleedTaken = 8 damage, no armor
    expect(result.enemyHealth).toBe(22);
  });

  it("amplifies physical damage against stunned enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({
      enemyStunSkipTurns: 1,
      talentEffects: { ...baseState().talentEffects, physicalVsStunnedMultiplier: 25 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 10 * (1 + 25/100) = 12.5 -> 13 round, no armor, health = 17
    expect(result.enemyHealth).toBe(17);
  });

  it("amplifies physical damage against frozen enemies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({
      enemyFreezeSkipTurns: 1,
      talentEffects: { ...baseState().talentEffects, physicalVsFrozenMultiplier: 50 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 10 * (1 + 50/100) = 15, no armor, health = 15
    expect(result.enemyHealth).toBe(15);
  });
});

describe("applyFirstDamageModifiers", () => {
  it("doubles first burn card damage when talent active", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // no crit
    const state = baseState({ talentEffects: { ...baseState().talentEffects, firstBurnCardDoubled: true } });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstBurnCardDoubledUsed).toBe(true);
    expect(result.enemyHealth).toBeLessThan(25);
  });

  it("does not double second burn card when flag is used", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, firstBurnCardDoubled: true },
      flags: { ...baseState().flags, firstBurnCardDoubledUsed: true },
    });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstBurnCardDoubledUsed).toBe(true);
    expect(result.enemyHealth).toBeGreaterThan(10);
  });

  it("doubles first burn damage via trinket effect", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({ trinketEffects: { ...baseState().trinketEffects, firstBurnDoubled: true } });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstBurnTrinketDoubledUsed).toBe(true);
  });

  it("doubles first holy damage when trinket effect active", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({ trinketEffects: { ...baseState().trinketEffects, firstHolyDamageDoubled: true } });
    const card = makeCard({ effects: [makeEffect("holy", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.flags.firstHolyDamageBonusUsed).toBe(true);
  });
});

describe("applyCrit", () => {
  it("applies crit multiplier when random rolls below threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const state = baseState({ talentEffects: { ...baseState().talentEffects, physicalCritChance: 0 } });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeLessThan(30 - 10);
  });

  it("stacks physical crit chance with global crit chance", () => {
    // Total = 5 + 10 = 15. random() * 100 < 15 means random() < 0.15
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const state = baseState({ talentEffects: { ...baseState().talentEffects, physicalCritChance: 10 } });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(30 - Math.floor(10 * CRIT_MULTIPLIER));
  });

  it("does not crit when random is above threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState();
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBeGreaterThan(20);
  });
});

describe("applyForgeStunRider", () => {
  it("stuns enemy when forge meets trinket threshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 5 },
      trinketEffects: { ...baseState().trinketEffects, forgeStunThreshold: 4, forgeStunAmount: 2 },
      enemyStatuses: { ...baseState().enemyStatuses, stun: 15 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyStunSkipTurns).toBeGreaterThan(0);
  });

  it("does not stun when forge is below threshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 2 },
      trinketEffects: { ...baseState().trinketEffects, forgeStunThreshold: 4, forgeStunAmount: 2 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyStunSkipTurns).toBe(0);
  });
});

describe("applyHolyDamageRiders", () => {
  it("heals player with holy lifesteal", () => {
    const state = baseState({
      playerHealth: 20,
      talentEffects: { ...baseState().talentEffects, holyLifestealPercent: 50 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerHealth).toBeGreaterThan(20);
  });

  it("grants block from holy damage with holyBlockPercentFromDamage", () => {
    const state = baseState({
      gold: 50,
      talentEffects: {
        ...baseState().talentEffects,
        holyBlockPercentFromDamage: 25,
        holyGoldPercent: 10,
        holyLifestealPercent: 0,
      },
    });
    const card = makeCard({ effects: [makeEffect("holy", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.block).toBeGreaterThan(0);
  });

  it("applies burn on holy damage with holyBurnChance", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, holyBurnChance: 50, holyLifestealPercent: 0, holyGoldPercent: 0 },
    });
    const card = makeCard({ effects: [makeEffect("holy", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyStatuses.burn).toBeGreaterThan(0);
  });
});

describe("applyGoldTroveReward", () => {
  it("grants gold when enemy has gold-trove trait", () => {
    const state = baseState({
      gold: 0,
      currentEnemy: {
        id: "mimic",
        title: "Mimic",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "gold-trove", title: "Gold Trove", description: "" }],
        attackEffects: [],
      },
    });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.gold).toBe(GOLD_TROVE_DAMAGE_REWARD);
  });

  it("does not grant gold without gold-trove trait", () => {
    const state = baseState({ gold: 0 });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.gold).toBe(0);
  });
});

describe("consumeForgeAfterPhysicalDamage", () => {
  it("consumes 1 forge after physical damage", () => {
    const state = baseState({ playerStatuses: { ...baseState().playerStatuses, forge: 3 } });
    const card = makeCard({ effects: [makeEffect("physical", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("consumes 1 forge after stun damage", () => {
    const state = baseState({ playerStatuses: { ...baseState().playerStatuses, forge: 3 } });
    const card = makeCard({ effects: [makeEffect("stun", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("does not consume forge for non-physical/non-stun damage", () => {
    const state = baseState({ playerStatuses: { ...baseState().playerStatuses, forge: 3 } });
    const card = makeCard({ effects: [makeEffect("burn", 5)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerStatuses.forge).toBe(3);
  });
});

describe("dealDamageToEnemy — lifesteal", () => {
  it("heals player when effect has lifesteal", () => {
    const state = baseState({
      playerHealth: 20,
      gold: 50,
      talentEffects: { ...baseState().talentEffects, healMultiplier: 0.5 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 10, { lifesteal: true })] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.playerHealth).toBeGreaterThan(20);
  });
});

describe("dealDamageToEnemy — enemy armor", () => {
  it("physical damage is reduced by enemy armor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({ enemyArmor: 3 });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 10 damage, 3 armor from enemy
    expect(result.enemyHealth).toBe(30 - 10 + 3);
  });

  it("sunderingArmorPiercing reduces effective armor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({
      enemyArmor: 5,
      trinketEffects: { ...baseState().trinketEffects, sunderingArmorPiercing: 2 },
    });
    const card = makeCard({ effects: [makeEffect("physical", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // 10 damage, 5-2=3 effective armor
    expect(result.enemyHealth).toBe(30 - 10 + 3);
  });

  it("non-physical damage ignores enemy armor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = baseState({ enemyArmor: 5 });
    const card = makeCard({ effects: [makeEffect("burn", 10)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    // Enemy armor only applies to physical damage. Burn deals full 10 damage.
    expect(result.enemyHealth).toBe(20);
  });
});

describe("dealDamageToEnemy — edge cases", () => {
  it("does not decrease health below 0", () => {
    const state = baseState({ enemyHealth: 3 });
    const card = makeCard({ effects: [makeEffect("physical", 100)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(0);
  });

  it("handles zero damage gracefully", () => {
    const state = baseState({ enemyHealth: 30, enemyArmor: 0 });
    const card = makeCard({ effects: [makeEffect("physical", 0)] });
    const texts = makeTexts();
    const result = dealDamageToEnemy(
      state,
      card,
      card.effects[0] as Extract<BattleCardEffect, { kind: "damage" }>,
      texts,
    );
    expect(result.enemyHealth).toBe(30);
    expect(result.playerStatuses.forge).toBe(0); // forge not consumed
  });
});
