import { describe, expect, it, vi } from "vitest";
import { applyPlayerStatusFromAttack } from "@/lib/battle/status-application";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";

vi.spyOn(Math, "random").mockReturnValue(0.99);

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
  bleedPoisonChance: 0, bleedPoisonDamageTakenBonus: 0, companionBleedDamageBonus: 0, receiveHalfBleedDamage: false, bleedHalvesEnemyHealing: false, flatArrowDamage: 0, freezeThresholdReduction: 0,
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

describe("applyPlayerStatusFromAttack", () => {
  describe("harmful statuses (burn, poison, bleed, freeze, stun)", () => {
    it.each(["burn", "poison", "bleed", "freeze", "stun"] as const)(
      "applies %s status from enemy attack",
      (status) => {
        const state = baseState();
        const texts: CombatTextEvent[] = [];
        const effect = { kind: "player-status" as const, status, amount: 5 };
        const result = applyPlayerStatusFromAttack(state, effect, texts);
        expect(result.playerStatuses[status]).toBe(5);
        expect(texts).toEqual([{ target: "player", kind: "damage", stat: status, amount: 5 }]);
      },
    );

    it("does not mutate original state", () => {
      const state = baseState();
      const texts: CombatTextEvent[] = [];
      applyPlayerStatusFromAttack(state, { kind: "player-status", status: "burn", amount: 3 }, texts);
      expect(state.playerStatuses.burn).toBe(0);
    });
  });

  describe("beneficial statuses (armor, block, forge, haste)", () => {
    it.each(["armor", "block", "forge", "haste"] as const)(
      "applies %s status from enemy attack with status combat text kind",
      (status) => {
        const state = baseState();
        const texts: CombatTextEvent[] = [];
        const effect = { kind: "player-status" as const, status, amount: 4 };
        const result = applyPlayerStatusFromAttack(state, effect, texts);
        expect(result.playerStatuses[status]).toBe(4);
        expect(texts).toEqual([{ target: "player", kind: "status", stat: status, amount: 4 }]);
      },
    );

    it("adds beneficial status to existing stack", () => {
      const state = baseState({ playerStatuses: { ...baseState().playerStatuses, armor: 3 } });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "armor", amount: 2 }, texts);
      expect(result.playerStatuses.armor).toBe(5);
    });
  });

  describe("freeze bonus from enemy mitigation", () => {
    it("adds freezeBonus to freeze amount when enemy has Glacial-Shell active", () => {
      const state = baseState({ enemyMitigation: { armor: 0, forge: 0, freezeBonus: 2 } });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "freeze", amount: 3 }, texts);
      expect(result.playerStatuses.freeze).toBe(5);
    });

    it("does not add freezeBonus to non-freeze statuses", () => {
      const state = baseState({ enemyMitigation: { armor: 0, forge: 0, freezeBonus: 2 } });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "burn", amount: 3 }, texts);
      expect(result.playerStatuses.burn).toBe(3);
    });
  });

  describe("block prevents status via talents", () => {
    it.each([
      { status: "bleed", talentKey: "blockPreventsBleed" as const },
      { status: "poison", talentKey: "blockPreventsPoison" as const },
      { status: "stun", talentKey: "blockPreventsStun" as const },
    ])("prevents $status when player has block and $talentKey talent", ({ status, talentKey }) => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, block: 5 },
        talentEffects: { ...TALENT_DEFAULTS, [talentKey]: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: status as "bleed" | "poison" | "stun", amount: 4 }, texts);
      expect(result.playerStatuses[status]).toBe(0);
    });

    it.each([
      { status: "bleed", talentKey: "blockPreventsBleed" as const },
      { status: "poison", talentKey: "blockPreventsPoison" as const },
      { status: "stun", talentKey: "blockPreventsStun" as const },
    ])("does not block $status when talent is inactive even with block", ({ status, talentKey }) => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, block: 5 },
        talentEffects: { ...TALENT_DEFAULTS, [talentKey]: false },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: status as "bleed" | "poison" | "stun", amount: 4 }, texts);
      expect(result.playerStatuses[status]).toBe(4);
    });

    it("does not block burn even with block and talents", () => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, block: 5 },
        talentEffects: { ...TALENT_DEFAULTS, blockPreventsBleed: true, blockPreventsPoison: true, blockPreventsStun: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "burn", amount: 3 }, texts);
      expect(result.playerStatuses.burn).toBe(3);
    });

    it("does not block freeze even with block and talents", () => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, block: 5 },
        talentEffects: { ...TALENT_DEFAULTS, blockPreventsBleed: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "freeze", amount: 3 }, texts);
      expect(result.playerStatuses.freeze).toBe(3);
    });
  });

  describe("armor mitigates stun", () => {
    it("reduces stun amount by player armor when armorMitigatesStun is active", () => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, armor: 3 },
        talentEffects: { ...TALENT_DEFAULTS, armorMitigatesStun: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "stun", amount: 5 }, texts);
      expect(result.playerStatuses.stun).toBe(2);
    });

    it("reduces stun to 0 when armor exceeds stun amount", () => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, armor: 10 },
        talentEffects: { ...TALENT_DEFAULTS, armorMitigatesStun: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "stun", amount: 5 }, texts);
      expect(result.playerStatuses.stun).toBe(0);
    });

    it("does not reduce stun when armorMitigatesStun is inactive", () => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, armor: 3 },
        talentEffects: { ...TALENT_DEFAULTS, armorMitigatesStun: false },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "stun", amount: 5 }, texts);
      expect(result.playerStatuses.stun).toBe(5);
    });
  });

  describe("plague doctor immunity trinket", () => {
    it("prevents first harmful status application when trinket is active", () => {
      const state = baseState({
        trinketEffects: { ...TRINKET_DEFAULTS, plagueDoctorImmunity: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "poison", amount: 3 }, texts);
      expect(result.playerStatuses.poison).toBe(0);
      expect(result.flags.firstHarmfulStatusPrevented).toBe(true);
    });

    it("allows second harmful status after first was already prevented", () => {
      const state = baseState({
        playerStatuses: { ...baseState().playerStatuses, poison: 2 },
        trinketEffects: { ...TRINKET_DEFAULTS, plagueDoctorImmunity: true },
        flags: { ...FLAG_DEFAULTS, firstHarmfulStatusPrevented: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "poison", amount: 3 }, texts);
      expect(result.playerStatuses.poison).toBe(5);
    });

    it("does not prevent beneficial statuses", () => {
      const state = baseState({
        trinketEffects: { ...TRINKET_DEFAULTS, plagueDoctorImmunity: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "armor", amount: 3 }, texts);
      expect(result.playerStatuses.armor).toBe(3);
    });
  });
});
