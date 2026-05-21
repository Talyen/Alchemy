import { describe, expect, it } from "vitest";
import {
  addPlayerStatus,
  addEnemyStatus,
  setEnemyStatus,
  addGold,
  setFlag,
  clampHealth,
  applyPlayerCombatDamage,
  applyPlayerHealing,
  isPlayerDefeated,
  type BattleState,
} from "@/lib/battle/types";
import type { PlayerStatusId, EnemyStatusId } from "@/lib/game-data";

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
      firstBurnCardDoubled: false, burnRemovesEnemyArmor: false, burnDoubleChance: 0, receiveHalfBurnDamage: false,
      shopCardDiscount: 0, shopFreeRefresh: false, startGold: 0, goldPerCombat: 0, potionDiscount: 0,
      potionPotency: 0, removeCardDiscount: 0, enemyGoldDropBonus: 0, eliteGoldDropBonus: 0,
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
    ...overrides,
  };
}

describe("addPlayerStatus", () => {
  it("adds delta to the given player status", () => {
    const state = baseState({ playerStatuses: { ...baseState().playerStatuses, block: 5 } });
    const next = addPlayerStatus(state, "block", 3);
    expect(next.playerStatuses.block).toBe(8);
  });

  it("does not mutate the original state", () => {
    const state = baseState();
    const next = addPlayerStatus(state, "block", 5);
    expect(state.playerStatuses.block).toBe(0);
    expect(next.playerStatuses.block).toBe(5);
  });

  it("supports negative delta", () => {
    const state = baseState({ playerStatuses: { ...baseState().playerStatuses, forge: 10 } });
    const next = addPlayerStatus(state, "forge", -3);
    expect(next.playerStatuses.forge).toBe(7);
  });

  it("works for all player status IDs", () => {
    const state = baseState();
    const ids: PlayerStatusId[] = ["block", "armor", "forge", "haste", "burn", "poison", "bleed", "freeze", "stun"];
    for (const id of ids) {
      const next = addPlayerStatus(state, id, 1);
      expect(next.playerStatuses[id]).toBe(1);
    }
  });
});

describe("addEnemyStatus", () => {
  it("adds delta to the given enemy status", () => {
    const state = baseState();
    const next = addEnemyStatus(state, "burn", 5);
    expect(next.enemyStatuses.burn).toBe(5);
  });

  it("does not mutate the original state", () => {
    const state = baseState();
    const next = addEnemyStatus(state, "poison", 3);
    expect(state.enemyStatuses.poison).toBe(0);
    expect(next.enemyStatuses.poison).toBe(3);
  });

  it("supports negative delta", () => {
    const state = baseState({ enemyStatuses: { ...baseState().enemyStatuses, burn: 4 } });
    const next = addEnemyStatus(state, "burn", -1);
    expect(next.enemyStatuses.burn).toBe(3);
  });

  it("works for all enemy status IDs", () => {
    const state = baseState();
    const ids: EnemyStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];
    for (const id of ids) {
      const next = addEnemyStatus(state, id, 2);
      expect(next.enemyStatuses[id]).toBe(2);
    }
  });
});

describe("setEnemyStatus", () => {
  it("sets the given enemy status to a specific value", () => {
    const state = baseState();
    const next = setEnemyStatus(state, "bleed", 8);
    expect(next.enemyStatuses.bleed).toBe(8);
  });
});

describe("addGold", () => {
  it("adds delta to gold", () => {
    const state = baseState({ gold: 10 });
    const next = addGold(state, 5);
    expect(next.gold).toBe(15);
  });

  it("supports negative delta", () => {
    const state = baseState({ gold: 50 });
    const next = addGold(state, -20);
    expect(next.gold).toBe(30);
  });

  it("does not mutate the original state", () => {
    const state = baseState({ gold: 10 });
    addGold(state, 5);
    expect(state.gold).toBe(10);
  });
});

describe("setFlag", () => {
  it("sets a boolean flag", () => {
    const state = baseState();
    const next = setFlag(state, "firstPhysicalCardFreeUsed", true);
    expect(next.flags.firstPhysicalCardFreeUsed).toBe(true);
  });

  it("sets a numeric flag", () => {
    const state = baseState();
    const next = setFlag(state, "nextCardCostReduction", 3);
    expect(next.flags.nextCardCostReduction).toBe(3);
  });

  it("does not mutate the original state", () => {
    const state = baseState();
    const next = setFlag(state, "firstBurnCardDoubledUsed", true);
    expect(state.flags.firstBurnCardDoubledUsed).toBe(false);
    expect(next.flags.firstBurnCardDoubledUsed).toBe(true);
  });

  it("preserves other flags", () => {
    const state = baseState({ flags: { ...baseState().flags, firstArmorCardDoubledUsed: true } });
    const next = setFlag(state, "firstHolyCardFreeUsed", true);
    expect(next.flags.firstHolyCardFreeUsed).toBe(true);
    expect(next.flags.firstArmorCardDoubledUsed).toBe(true);
  });
});

describe("clampHealth", () => {
  it("adds delta within bounds", () => {
    expect(clampHealth(20, 5, 30)).toBe(25);
  });

  it("caps at max", () => {
    expect(clampHealth(28, 5, 30)).toBe(30);
  });

  it("floors at 0", () => {
    expect(clampHealth(10, -15, 30)).toBe(0);
  });

  it("handles exact boundaries", () => {
    expect(clampHealth(0, 0, 30)).toBe(0);
    expect(clampHealth(30, 0, 30)).toBe(30);
  });
});

describe("applyPlayerCombatDamage", () => {
  it("reduces player health", () => {
    const state = baseState({ playerHealth: 20 });
    const next = applyPlayerCombatDamage(state, 5);
    expect(next.playerHealth).toBe(15);
  });

  it("returns same state when damage is 0", () => {
    const state = baseState({ playerHealth: 20 });
    const next = applyPlayerCombatDamage(state, 0);
    expect(next).toBe(state);
  });

  it("returns same state when damage is negative", () => {
    const state = baseState({ playerHealth: 20 });
    const next = applyPlayerCombatDamage(state, -5);
    expect(next).toBe(state);
  });

  it("triggers Death's Door on first lethal hit", () => {
    const state = baseState({ playerHealth: 10, turn: 3 });
    const next = applyPlayerCombatDamage(state, 20);
    expect(next.playerHealth).toBe(0);
    expect(next.deathsDoorUsed).toBe(true);
    expect(next.deathsDoorActive).toBe(true);
    expect(next.deathsDoorTriggeredTurn).toBe(3);
  });

  it("does not trigger Death's Door again on second lethal hit", () => {
    const state = baseState({ playerHealth: 10, deathsDoorUsed: true, deathsDoorActive: true, deathsDoorTriggeredTurn: 3, turn: 4 });
    const next = applyPlayerCombatDamage(state, 20);
    expect(next.playerHealth).toBe(0);
    expect(next.deathsDoorUsed).toBe(true);
    expect(next.deathsDoorActive).toBe(true);
  });

  it("is defeated when hit while Death's Door already used and health was already 0", () => {
    const state = baseState({ playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: false, deathsDoorTriggeredTurn: 3 });
    const next = applyPlayerCombatDamage(state, 5);
    expect(next.playerHealth).toBe(0);
    expect(next.deathsDoorActive).toBe(false);
  });
});

describe("applyPlayerHealing", () => {
  it("increases player health", () => {
    const state = baseState({ playerHealth: 15 });
    const next = applyPlayerHealing(state, 10);
    expect(next.playerHealth).toBe(25);
  });

  it("caps at max health", () => {
    const state = baseState({ playerHealth: 28 });
    const next = applyPlayerHealing(state, 10);
    expect(next.playerHealth).toBe(30);
  });

  it("clears Death's Door when healing above 0", () => {
    const state = baseState({ playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: true, deathsDoorTriggeredTurn: 3 });
    const next = applyPlayerHealing(state, 5);
    expect(next.playerHealth).toBe(5);
    expect(next.deathsDoorActive).toBe(false);
  });

  it("preserves Death's Door active when still at 0 Health after heal", () => {
    const state = baseState({ playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: true, deathsDoorTriggeredTurn: 3 });
    const next = applyPlayerHealing(state, 0);
    expect(next.playerHealth).toBe(0);
    expect(next.deathsDoorActive).toBe(true);
  });

  it("does not mutate original state", () => {
    const state = baseState({ playerHealth: 10 });
    applyPlayerHealing(state, 5);
    expect(state.playerHealth).toBe(10);
  });
});

describe("isPlayerDefeated", () => {
  it("returns false when health > 0", () => {
    expect(isPlayerDefeated({ playerHealth: 5, deathsDoorActive: false })).toBe(false);
  });

  it("returns false when Death's Door is active even at 0 Health", () => {
    expect(isPlayerDefeated({ playerHealth: 0, deathsDoorActive: true })).toBe(false);
  });

  it("returns true when health <= 0 and no Death's Door", () => {
    expect(isPlayerDefeated({ playerHealth: 0, deathsDoorActive: false })).toBe(true);
  });

  it("returns true when health is negative and no Death's Door", () => {
    expect(isPlayerDefeated({ playerHealth: -5, deathsDoorActive: false })).toBe(true);
  });

  it("returns true when health <= 0 and Death's Door already expired", () => {
    expect(isPlayerDefeated({ playerHealth: 0, deathsDoorActive: false })).toBe(true);
  });
});
