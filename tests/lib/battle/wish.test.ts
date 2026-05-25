import { describe, expect, it, vi } from "vitest";
import { buildWishOptions, applyWishEffect } from "@/lib/battle/wish";
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
      manaOnWish: 0, wishBoonChoice: false, wishBlockBelowHealthPct: 0, wishCardsUpgraded: false,
      firstPoisonCardFree: false, poisonPhysicalBonus: 0, poisonGainChance: 0, receiveHalfPoisonDamage: false,
      goldOnFirstPoison: 0, poisonHalvesHealing: false,
      poisonStunChance: 0, poisonStripArmor: false, poisonReducesEnemyDamage: 0, poisonLeechChance: 0,
      companionDamage: 0, companionGoldFindActive: false,
      firstBleedCardFree: false, bleedPhysicalBonus: 0, bleedLeechChance: 0,
      bleedExecuteThreshold: 0, bleedDesperateMultiplier: 1, bleedPoisonChance: 0,
      bleedPoisonDamageTakenBonus: 0, companionBleedDamageBonus: 0, receiveHalfBleedDamage: false, bleedHalvesEnemyHealing: false,
      flatArrowDamage: 0,       freezeThresholdReduction: 0, freezeDoubleDamage: false, blockOnFreeze: 0, freezeStripArmor: false, startFreeze: 0, companionVsFrozenBonus: 0, freezePreventsPoisonDecay: false, freezeBlocksRegen: false, freezePreventsEnemyScaling: false, receiveHalfFreezeBuildUp: false, maxHealthPerCombat: 0,
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

describe("buildWishOptions", () => {
  it("returns shuffled options excluding the triggering card", () => {
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 4 }] };
    const state = baseState();
    const options = buildWishOptions(state, card);
    expect(options).toHaveLength(3);
    expect(options.every((o) => o.id !== "strike")).toBe(true);
    expect(options.every((o) => o.id && o.title)).toBe(true);
  });

  it("returns only undiscovered cards when wishUndiscoveredCards is active", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, wishUndiscoveredCards: true },
      discoveredCardIds: ["strike", "bash", "block"],
    });
    const options = buildWishOptions(state, card);
    expect(options).toHaveLength(3);
    expect(options.every((o) => !["strike", "bash", "block"].includes(o.id))).toBe(true);
  });

  it("falls back to all cards when not enough undiscovered exist", () => {
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, wishUndiscoveredCards: true },
      discoveredCardIds: (() => { const ids = []; for (let i = 0; i < 200; i++) ids.push(`card-${i}`); return ids; })(),
    });
    const options = buildWishOptions(state, card);
    expect(options).toHaveLength(3);
  });
});

describe("applyWishEffect", () => {
  it("returns same state when wish amount is 0", () => {
    const state = baseState();
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 0, texts);
    expect(result).toBe(state);
  });

  it("returns same state when wish amount is negative", () => {
    const state = baseState();
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, -1, texts);
    expect(result).toBe(state);
  });

  it("sets wishOptions when no existing wish is active", () => {
    const state = baseState({ wishOptions: null, wishQueue: [] });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.wishOptions).not.toBeNull();
    expect(result.wishOptions).toHaveLength(3);
  });

  it("queues extra wishes when an existing wish is active", () => {
    const initialOptions = [{ id: "card-1", title: "Card 1", descriptionLines: [""], art: "", cost: 1, effects: [] }];
    const state = baseState({ wishOptions: initialOptions, wishQueue: [] });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.wishOptions).toBe(initialOptions);
    expect(result.wishQueue).toHaveLength(1);
  });

  it("awards goldOnWish per wish count", () => {
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, goldOnWish: 5 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 2, texts);
    expect(result.gold).toBe(10);
    // mergeCombatText deduplicates by (target, kind, stat), so gold events merge
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 10 }]);
  });

  it("awards goldOnWishAmount per wish", () => {
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, goldOnWishAmount: 3 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.gold).toBe(3);
  });

  it("awards wishingWellGoldOnWish per wish", () => {
    const state = baseState({
      trinketEffects: { ...baseState().trinketEffects, wishingWellGoldOnWish: 7 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.gold).toBe(7);
  });

  it("heals player with healthOnWish per wish", () => {
    const state = baseState({
      playerHealth: 20,
      talentEffects: { ...baseState().talentEffects, healthOnWish: 4 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.playerHealth).toBe(24);
  });

  it("removes harmful status with removeHarmfulStatusOnWish", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, burn: 5, poison: 3 },
      talentEffects: { ...baseState().talentEffects, removeHarmfulStatusOnWish: true },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(3);
  });

  it("draws card with wishDrawsCard", () => {
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 4 }] };
    const state = baseState({
      deck: [card],
      talentEffects: { ...baseState().talentEffects, wishDrawsCard: true },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.hand).toHaveLength(1);
    expect(result.deck).toHaveLength(0);
  });

  it("combines multiple gold bonuses from same wish", () => {
    const state = baseState({
      talentEffects: {
        ...baseState().talentEffects,
        goldOnWish: 5,
        goldOnWishAmount: 3,
      },
      trinketEffects: { ...baseState().trinketEffects, wishingWellGoldOnWish: 2 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.gold).toBe(10);
  });

  it("applies per-wish effects for each wish count", () => {
    const state = baseState({
      playerHealth: 20,
      talentEffects: { ...baseState().talentEffects, healthOnWish: 3, goldOnWish: 2 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 3, texts);
    expect(result.playerHealth).toBe(29);
    expect(result.gold).toBe(6);
  });
});
