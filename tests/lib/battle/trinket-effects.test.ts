import { describe, expect, it, vi } from "vitest";
import { applyIronwoodBuckler, applyBoneCharmHeal, applyLuckyCloverGold } from "@/lib/battle/trinket-effects";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";

vi.spyOn(Math, "random").mockReturnValue(0.99);

function baseState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    deck: [], hand: [], discard: [], exhausted: [], mana: 4, maxMana: 4, gold: 0,
    turn: 1, turnPhase: "player", playerHealth: 30, playerMaxHealth: 30,
    deathsDoorUsed: false, deathsDoorActive: false, deathsDoorTriggeredTurn: null,
    enemyHealth: 30, enemyMaxHealth: 30, enemyAttackEffects: [],
    enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0 },
    enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    pendingBleedLeechHealing: 0,
    enemyStunSkipTurns: 0, enemyFreezeSkipTurns: 0, wishOptions: null, wishQueue: [],
    activeCompanion: null, companionDamageBuff: 0,
    currentEnemy: { id: "skeleton", title: "Skeleton", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [], attackEffects: [] },
    talentEffects: {
      flatPhysicalDamage: 0, armorToPhysicalDamage: false, physicalCritChance: 0,
      firstPhysicalCardFree: false, physicalVsStunnedMultiplier: 0, physicalVsFrozenMultiplier: 0,
      stunThresholdReduction: 0, drawOnStun: 0, nextCardFreeOnStun: false,
      startBlock: 0, blockToPhysicalDamage: false, blockPreventsBleed: false, blockPreventsPoison: false,
      blockPreventsStun: false, blockAbsorbPhysicalBonus: 0, blockReduceBurnDamage: 0, blockDepletedHeal: 0, blockToHolyDamage: false, blockToStunDamage: false,
      forgeToBurn: false, forgeToHoly: false, forgeToBlock: false, forgeToBleed: false, forgeBurnThreshold: 0, forgeBurnDamage: 0,
      startForge: 0, forgeStripArmorThreshold: 0, flatForgeGained: 0, forgeDoubledBelowHalfHealth: false,
      forgeBlockThreshold: 0, forgeBlockAmount: 0,
      armorMitigatesBurn: false, armorBlockThreshold: 0, armorBlockAmount: 0, armorDoubledBelowHalfHealth: false,
      firstArmorCardDoubled: false, startArmor: 0, armorMitigatesBleed: false, armorBreakBlock: 0, armorMitigatesStun: false, armorCleanseThreshold: 0, flatArmorAmount: 0,
      campfireHealBonus: 0, healthThresholdBlock: null, maxHealthPerCombat: 0, startHealth: 0, healMultiplier: 1,
      healthThresholdArmor: null,
      overhealToBlockRatio: 0, healOnStatusCleanse: 0, deathsDoorExtension: 0, damageReduction: 0,
      firstBurnCardDoubled: false, burnRemovesEnemyArmor: false, burnDoubleChance: 0, receiveHalfBurnDamage: false, flatBurnDamage: 0, forgeOnPlayerBurnDamage: 0, burnReducesEnemyDamage: 0, burnOnConsumeAmount: 0, forgeOnBurnTickWithBlock: 0, burnOnWish: 0,
      shopCardDiscount: 0, shopFreeRefresh: false, startGold: 0, goldPerCombat: 0, potionDiscount: 0,
      potionPotency: 0, removeCardDiscount: 0, enemyGoldDropBonus: 0, eliteGoldDropBonus: 0,
      goldOnWish: 0, mixPotionDiscount: 0, companionBondLevels: {},
      holyLifestealPercent: 0, firstHolyCardFree: false, holyGoldPercent: 0, holyBurnChance: 0,
      receiveHalfHolyDamage: false, holyBlockPercent: 0, holyWishChance: 0, holyBlockPercentFromDamage: 0,
      holyVsBurnMultiplier: 0,
      goldOnWishAmount: 0, wishUndiscoveredCards: false, healthOnWish: 0, removeHarmfulStatusOnWish: false,
      wishExtraChoiceChance: 0, wishDrawsCard: false,
      firstPoisonCardFree: false, poisonPhysicalBonus: 0, poisonGainChance: 0, receiveHalfPoisonDamage: false,
      goldOnFirstPoison: 0, poisonHalvesHealing: false,
      poisonStunChance: 0, poisonStripArmor: false, poisonReducesEnemyDamage: 0, poisonLeechChance: 0,
      companionDamage: 0, companionGoldFindActive: false,
      firstBleedCardFree: false, bleedPhysicalBonus: 0, bleedLeechChance: 0,
      bleedExecuteThreshold: 0, bleedDesperateMultiplier: 1, bleedPoisonChance: 0,
      bleedPoisonDamageTakenBonus: 0, companionBleedDamageBonus: 0, receiveHalfBleedDamage: false, bleedHalvesEnemyHealing: false,
      flatTrapDamage: 0,       freezeThresholdReduction: 0, freezeDoubleDamage: false, blockOnFreeze: 0, freezeStripArmor: false, startFreeze: 0, companionVsFrozenBonus: 0, freezePreventsPoisonDecay: false, freezeBlocksRegen: false, freezePreventsEnemyScaling: false, receiveHalfFreezeBuildUp: false, maxHealthPerCombat: 0,
      flatStunDamage: 0, blockOnStun: 0, forgeOnStun: 0, stunStripArmor: false, manaOnStun: 0,
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
    rng: Math.random,
    ...overrides,
  };
}

describe("applyIronwoodBuckler", () => {
  it("converts block to armor when block >= threshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, block: 10 },
      trinketEffects: { ...baseState().trinketEffects, blockToArmorThreshold: 5, blockToArmorAmount: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyIronwoodBuckler(state, texts);
    expect(next.playerStatuses.armor).toBe(3);
    expect(next.playerStatuses.block).toBe(10);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "armor", amount: 3 }]);
  });

  it("does nothing when block is below threshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, block: 3 },
      trinketEffects: { ...baseState().trinketEffects, blockToArmorThreshold: 5, blockToArmorAmount: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyIronwoodBuckler(state, texts);
    expect(next.playerStatuses.armor).toBe(0);
    expect(texts).toEqual([]);
  });

  it("does nothing when threshold is 0 (trinket not owned)", () => {
    const state = baseState({ playerStatuses: { ...baseState().playerStatuses, block: 10 } });
    const texts: CombatTextEvent[] = [];
    const next = applyIronwoodBuckler(state, texts);
    expect(next.playerStatuses.armor).toBe(0);
    expect(texts).toEqual([]);
  });

  it("does not mutate original state", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, block: 10 },
      trinketEffects: { ...baseState().trinketEffects, blockToArmorThreshold: 5, blockToArmorAmount: 3 },
    });
    const texts: CombatTextEvent[] = [];
    applyIronwoodBuckler(state, texts);
    expect(state.playerStatuses.armor).toBe(0);
  });
});

describe("applyBoneCharmHeal", () => {
  it("heals player on enemy kill when boneCharmHealOnKill > 0", () => {
    const state = baseState({
      enemyHealth: 0,
      playerHealth: 20,
      trinketEffects: { ...baseState().trinketEffects, boneCharmHealOnKill: 5 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyBoneCharmHeal(state, true, texts);
    expect(next.playerHealth).toBe(25);
    expect(texts).toEqual([{ target: "player", kind: "heal", stat: "health", amount: 5 }]);
  });

  it("does nothing when enemy was not alive before this hit", () => {
    const state = baseState({ enemyHealth: 0 });
    const texts: CombatTextEvent[] = [];
    const next = applyBoneCharmHeal(state, false, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("does nothing when enemy is still alive", () => {
    const state = baseState({ enemyHealth: 10 });
    const texts: CombatTextEvent[] = [];
    const next = applyBoneCharmHeal(state, true, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("does nothing when boneCharmHealOnKill is 0", () => {
    const state = baseState({ enemyHealth: 0 });
    const texts: CombatTextEvent[] = [];
    const next = applyBoneCharmHeal(state, true, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });
});

describe("applyLuckyCloverGold", () => {
  it("grants gold on damage when luckyCloverGoldChance triggers", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.01);
    const state = baseState({
      trinketEffects: { ...baseState().trinketEffects, luckyCloverGoldChance: 50 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 7, texts);
    expect(next.gold).toBe(7);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 7 }]);
  });

  it("does nothing when random does not trigger", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99);
    const state = baseState({
      trinketEffects: { ...baseState().trinketEffects, luckyCloverGoldChance: 50 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 7, texts);
    expect(next.gold).toBe(0);
    expect(texts).toEqual([]);
  });

  it("does nothing when luckyCloverGoldChance is 0", () => {
    const state = baseState();
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 7, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("does nothing when damage is 0", () => {
    const state = baseState({
      trinketEffects: { ...baseState().trinketEffects, luckyCloverGoldChance: 50 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 0, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("does nothing when damage is negative", () => {
    const state = baseState({
      trinketEffects: { ...baseState().trinketEffects, luckyCloverGoldChance: 50 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, -3, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });
});
