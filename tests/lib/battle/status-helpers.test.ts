import { describe, expect, it, vi } from "vitest";
import { decayHalvedStatus, rollPercent, decayArmorAfterDamage } from "@/lib/battle/status-helpers";
import { BATTLE_CONFIG, PERCENT_DENOMINATOR } from "@/lib/game-constants";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";

const TALENT_DEFAULTS = {
  flatPhysicalDamage: 0, armorToPhysicalDamage: false, physicalCritChance: 0,
  firstPhysicalCardFree: false, physicalVsStunnedMultiplier: 0, physicalVsFrozenMultiplier: 0,
  stunThresholdReduction: 0, drawOnStun: 0, nextCardFreeOnStun: false,
  stunDurationExtension: 0, stunDoubleDamage: false, flatStunDamage: 0,
  blockOnStun: 0, forgeOnStun: 0, stunStripArmor: false, manaOnStun: 0,
  startBlock: 0, blockToPhysicalDamage: false, blockPreventsBleed: false,
  blockPreventsPoison: false, blockPreventsStun: false, blockAbsorbPhysicalBonus: 0,
  blockReduceBurnDamage: 0, blockDepletedHeal: 0, blockToHolyDamage: false,
  blockToStunDamage: false, startForge: 0, forgeToBurn: false, forgeToHoly: false,
  forgeToBlock: false, forgeToBleed: false, forgeBurnThreshold: 0, forgeBurnDamage: 0,
  forgeStripArmorThreshold: 0, flatForgeGained: 0, forgeDoubledBelowHalfHealth: false,
  forgeBlockThreshold: 0, forgeBlockAmount: 0, armorMitigatesBurn: false,
  armorBlockThreshold: 0, armorBlockAmount: 0, armorDoubledBelowHalfHealth: false,
  firstArmorCardDoubled: false, startArmor: 0, armorMitigatesBleed: false,
  armorBreakBlock: 0, armorMitigatesStun: false, armorCleanseThreshold: 0,
  flatArmorAmount: 0, campfireHealBonus: 0, healthThresholdBlock: null,
  maxHealthPerCombat: 0, startHealth: 0, healMultiplier: 1, healthThresholdArmor: null,
  overhealToBlockRatio: 0, healOnStatusCleanse: 0, deathsDoorExtension: 0, damageReduction: 0,
  firstBurnCardDoubled: false, burnRemovesEnemyArmor: false, burnDoubleChance: 0,
  receiveHalfBurnDamage: false, flatBurnDamage: 0, forgeOnPlayerBurnDamage: 0, burnReducesEnemyDamage: 0, burnOnConsumeAmount: 0, forgeOnBurnTickWithBlock: 0, burnOnWish: 0, shopCardDiscount: 0, shopFreeRefresh: false,
  startGold: 0, goldPerCombat: 0, potionDiscount: 0, potionPotency: 0,
  removeCardDiscount: 0, enemyGoldDropBonus: 0, eliteGoldDropBonus: 0,
  goldOnWish: 0, mixPotionDiscount: 0, companionBondLevels: {},
  holyLifestealPercent: 0, firstHolyCardFree: false, holyGoldPercent: 0,
  holyBurnChance: 0, receiveHalfHolyDamage: false, holyBlockPercent: 0,
  holyWishChance: 0, holyBlockPercentFromDamage: 0, holyVsBurnMultiplier: 0,
  goldOnWishAmount: 0, wishUndiscoveredCards: false, healthOnWish: 0,
  removeHarmfulStatusOnWish: false, wishExtraChoiceChance: 0, wishDrawsCard: false,
  firstPoisonCardFree: false, poisonPhysicalBonus: 0, poisonGainChance: 0,
  receiveHalfPoisonDamage: false, goldOnFirstPoison: 0, poisonHalvesHealing: false,
  poisonStunChance: 0, poisonStripArmor: false, poisonReducesEnemyDamage: 0, poisonLeechChance: 0,
  companionDamage: 0, companionGoldFindActive: false, firstBleedCardFree: false,
  bleedPhysicalBonus: 0, bleedLeechChance: 0,
  bleedExecuteThreshold: 0, bleedDesperateMultiplier: 1,
  bleedPoisonChance: 0, bleedPoisonDamageTakenBonus: 0, companionBleedDamageBonus: 0, receiveHalfBleedDamage: false, bleedHalvesEnemyHealing: false, flatTrapDamage: 0, freezeThresholdReduction: 0,
  freezeDoubleDamage: false, blockOnFreeze: 0, freezeStripArmor: false,
  startFreeze: 0, companionVsFrozenBonus: 0, freezePreventsPoisonDecay: false,
  freezeBlocksRegen: false, freezePreventsEnemyScaling: false, receiveHalfFreezeBuildUp: false,
};

const TRINKET_DEFAULTS = {
  extraDrawPerBattle: 0, firstHolyDamageDoubled: false, firstBurnDoubled: false,
  boneCharmHealOnKill: 0, forgeStunThreshold: 0, forgeStunAmount: 0,
  frozenHeartDamage: 0, blockToArmorThreshold: 0, blockToArmorAmount: 0,
  runicQuillDrawOnConsume: 0, sinEaterHealOnHarmfulStatusRemove: 0,
  vanguardCrestForgeOnBlockAbsorb: 0, parasiticBloomLeechChance: 0,
  cutpurseGoldOnBleed: 0, wishingWellGoldOnWish: 0, plagueDoctorImmunity: false,
  mortarPestleFreeFirstPotion: false, sunderingArmorPiercing: 0,
  resonantChimeCardsRequired: 0, resonantChimeMana: 0,
  smugglersMapGoldBonus: 0, grovesFavorStartHeal: 0, merchantsFavorDiscount: 0,
  companionDamageBonus: 0, freezeDurationExtension: 0,
  thunderstoneDamageOnStun: 0, luckyCloverGoldChance: 0,
};

const FLAG_DEFAULTS = {
  firstPhysicalCardFreeUsed: false, firstHolyCardFreeUsed: false,
  firstBurnCardDoubledUsed: false, firstArmorCardDoubledUsed: false,
  firstPoisonCardFreeUsed: false, firstBleedCardFreeUsed: false,
  nextCardCostReduction: 0, goldOnFirstPoisonThisCombat: false,
  firstHolyDamageBonusUsed: false, firstBurnTrinketDoubledUsed: false,
  firstHarmfulStatusPrevented: false, firstPotionFreeUsed: false,
  resonantChimeUsedThisTurn: false,
};

function baseState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    deck: [], hand: [], discard: [], exhausted: [],
    mana: 4, maxMana: 4, gold: 0, turn: 1, turnPhase: "player",
    playerHealth: 30, playerMaxHealth: 30,
    deathsDoorUsed: false, deathsDoorActive: false, deathsDoorTriggeredTurn: null,
    enemyHealth: 30, enemyMaxHealth: 30, enemyAttackEffects: [],
    enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0 },
    enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    pendingBleedLeechHealing: 0,
    enemyStunSkipTurns: 0, enemyFreezeSkipTurns: 0,
    playerStunSkipTurns: 0, playerFreezeSkipTurns: 0,
    playerCCCooldown: 0, enemyCCCooldown: 0,
    wishOptions: null, wishQueue: [],
    activeCompanion: null, companionDamageBuff: 0,
    currentEnemy: { id: "skeleton", title: "Skeleton", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [], attackEffects: [] },
    talentEffects: { ...TALENT_DEFAULTS },
    trinketEffects: { ...TRINKET_DEFAULTS },
    flags: { ...FLAG_DEFAULTS },
    discoveredCardIds: [],
    cardsPlayedThisTurn: 0,
    nextCardUid: 0,
    difficultyModifiers: [],
    rng: Math.random,
    ...overrides,
  };
}

describe("decayHalvedStatus", () => {
  it("returns 0 for value 0", () => {
    expect(decayHalvedStatus(0)).toBe(0);
  });

  it("returns 0 for value 1 (<= threshold)", () => {
    expect(decayHalvedStatus(1)).toBe(0);
  });

  it("halves even values", () => {
    expect(decayHalvedStatus(10)).toBe(5);
    expect(decayHalvedStatus(4)).toBe(2);
    expect(decayHalvedStatus(2)).toBe(1);
  });

  it("rounds odd values down via Math.round", () => {
    expect(decayHalvedStatus(3)).toBe(2);
    expect(decayHalvedStatus(5)).toBe(3);
    expect(decayHalvedStatus(7)).toBe(4);
  });

  it("handles large values", () => {
    expect(decayHalvedStatus(100)).toBe(50);
    expect(decayHalvedStatus(99)).toBe(50);
  });
});

describe("rollPercent", () => {
  it("returns true when random value is below chance threshold", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.49 / PERCENT_DENOMINATOR);
    expect(rollPercent(50, Math.random)).toBe(true);
  });

  it("returns false when random value is above chance threshold", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99);
    expect(rollPercent(50, Math.random)).toBe(false);
  });

  it("returns false for 0 chance", () => {
    expect(rollPercent(0, Math.random)).toBe(false);
  });

  it("triggers at exact boundary values", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(49 / PERCENT_DENOMINATOR);
    expect(rollPercent(50, Math.random)).toBe(true);
    vi.spyOn(Math, "random").mockReturnValueOnce(50 / PERCENT_DENOMINATOR);
    expect(rollPercent(50, Math.random)).toBe(false);
  });
});

describe("decayArmorAfterDamage", () => {
  describe("enemy armor decay", () => {
    it("decays enemy armor by ARMOR_DECAY_AMOUNT when damage > 0", () => {
      const state = baseState({ enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0 } });
      const result = decayArmorAfterDamage(state, 3, "enemy");
      expect(result.enemyMitigation.armor).toBe(5 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
    });

    it("does not decay enemy armor when damage is 0", () => {
      const state = baseState({ enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0 } });
      const result = decayArmorAfterDamage(state, 0, "enemy");
      expect(result).toBe(state);
    });

    it("does not decay enemy armor when already 0", () => {
      const state = baseState({ enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0 } });
      const result = decayArmorAfterDamage(state, 3, "enemy");
      expect(result.enemyMitigation.armor).toBe(0);
    });

    it("clamps enemy armor to 0 (does not go negative)", () => {
      const state = baseState({ enemyMitigation: { armor: 1, forge: 0, freezeBonus: 0 } });
      const result = decayArmorAfterDamage(state, 3, "enemy");
      expect(result.enemyMitigation.armor).toBe(0);
    });

    it("does not mutate original state for enemy decay", () => {
      const state = baseState({ enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0 } });
      decayArmorAfterDamage(state, 3, "enemy");
      expect(state.enemyMitigation.armor).toBe(5);
    });
  });

  describe("player armor decay", () => {
    it("decays player armor by ARMOR_DECAY_AMOUNT when damage > 0", () => {
      const state = baseState({ playerStatuses: { ...baseState().playerStatuses, armor: 5 } });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.armor).toBe(5 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
    });

    it("does not decay player armor when damage is 0", () => {
      const state = baseState({ playerStatuses: { ...baseState().playerStatuses, armor: 5 } });
      const result = decayArmorAfterDamage(state, 0, "player");
      expect(result).toBe(state);
    });

    it("does not decay player armor when armor is already 0", () => {
      const state = baseState({ playerStatuses: { ...baseState().playerStatuses, armor: 0 } });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.armor).toBe(0);
    });

    it("does not mutate original state", () => {
      const state = baseState({ playerStatuses: { ...baseState().playerStatuses, armor: 5 } });
      decayArmorAfterDamage(state, 3, "player");
      expect(state.playerStatuses.armor).toBe(5);
    });
  });

  describe("armorBreakBlock talent on player armor break", () => {
    it("grants block when armor breaks and armorBreakBlock talent is active", () => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, armor: 1 },
        talentEffects: { ...TALENT_DEFAULTS, armorBreakBlock: 4 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.armor).toBe(0);
      expect(result.playerStatuses.block).toBe(4);
      expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 4 }]);
    });

    it("does not grant block when armor does not break (still positive after decay)", () => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, armor: 5 },
        talentEffects: { ...TALENT_DEFAULTS, armorBreakBlock: 4 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.armor).toBe(4);
      expect(result.playerStatuses.block).toBe(0);
      expect(texts).toEqual([]);
    });

    it("does not grant block when armorBreakBlock is 0", () => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, armor: 1 },
        talentEffects: { ...TALENT_DEFAULTS, armorBreakBlock: 0 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.armor).toBe(0);
      expect(result.playerStatuses.block).toBe(0);
      expect(texts).toEqual([]);
    });

    it("does not emit combat text when texts array is not provided", () => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, armor: 1 },
        talentEffects: { ...TALENT_DEFAULTS, armorBreakBlock: 4 },
      });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.block).toBe(4);
    });

    it("clamps player armor to 0 when decay exceeds current", () => {
      const state = baseState({ playerStatuses: { ...baseState().playerStatuses, armor: 0 } });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.armor).toBe(0);
    });
  });
});
