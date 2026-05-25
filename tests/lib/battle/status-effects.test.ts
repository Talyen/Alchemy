import { describe, expect, it, vi } from "vitest";
import {
  resolveStunTrigger,
  applyDamageStatuses,
  applyPlayerStatusEffect,
  removeHarmfulPlayerStatuses,
} from "@/lib/battle/status-effects";
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
    playerCCCooldown: 0,
    enemyCCCooldown: 0,
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
      overhealToBlockRatio: 0,
      healOnStatusCleanse: 0,
      deathsDoorExtension: 0,
      damageReduction: 0,
      firstBurnCardDoubled: false,
      burnRemovesEnemyArmor: false,
      burnDoubleChance: 0,
      receiveHalfBurnDamage: false,
      flatBurnDamage: 0,
      forgeOnPlayerBurnDamage: 0,
      burnReducesEnemyDamage: 0,
      burnOnConsumeAmount: 0,
      forgeOnBurnTickWithBlock: 0,
      burnOnWish: 0,
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
      poisonStunChance: 0,
      poisonStripArmor: false,
      poisonReducesEnemyDamage: 0,
      poisonLeechChance: 0,
      companionDamage: 0,
      companionGoldFindActive: false,
      firstBleedCardFree: false,
      bleedPhysicalBonus: 0,
      bleedLeechChance: 0,
      bleedExecuteThreshold: 0,
      bleedDesperateMultiplier: 1,
      bleedPoisonChance: 0,
      bleedPoisonDamageTakenBonus: 0,
      companionBleedDamageBonus: 0,
      receiveHalfBleedDamage: false,
      bleedHalvesEnemyHealing: false,
      flatArrowDamage: 0,
      freezeThresholdReduction: 0,
      freezeDoubleDamage: false,
      blockOnFreeze: 0,
      freezeStripArmor: false,
      startFreeze: 0,
      companionVsFrozenBonus: 0,
      freezePreventsPoisonDecay: false,
      freezeBlocksRegen: false,
      freezePreventsEnemyScaling: false,
      receiveHalfFreezeBuildUp: false,
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
    rng: Math.random,
    ...overrides,
  };
}

function makeTexts(): CombatTextEvent[] {
  return [];
}

// ─── resolveStunTrigger ───

describe("resolveStunTrigger", () => {
  it("does nothing when stun is below threshold", () => {
    const state = baseState({ enemyHealth: 30, enemyStatuses: { ...baseState().enemyStatuses, stun: 5 } });
    const result = resolveStunTrigger(state);
    expect(result).toBe(state);
  });

  it("resets stun and skips turns when stun exceeds threshold", () => {
    const base = baseState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...base.enemyStatuses, stun: 20 },
    };
    const result = resolveStunTrigger(state);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyStunSkipTurns).toBe(1);
  });

  it("does nothing when enemy is dead", () => {
    const state = baseState({
      enemyHealth: 0,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
    });
    const result = resolveStunTrigger(state);
    expect(result).toBe(state);
  });

  it("skips additional turns with stunDurationExtension", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      talentEffects: { ...baseState().talentEffects, stunDurationExtension: 2 },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyStunSkipTurns).toBe(3);
  });

  it("draws cards with drawOnStun", () => {
    const card = {
      id: "strike",
      title: "Strike",
      descriptionLines: [""],
      art: "",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    };
    const state = baseState({
      deck: [card, card, card],
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      talentEffects: { ...baseState().talentEffects, drawOnStun: 2 },
    });
    const result = resolveStunTrigger(state);
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
  });

  it("sets nextCardCostReduction with nextCardFreeOnStun", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      talentEffects: { ...baseState().talentEffects, nextCardFreeOnStun: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.flags.nextCardCostReduction).toBe(99);
  });

  it("deals thunderstone damage and generates combat text", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      trinketEffects: { ...baseState().trinketEffects, thunderstoneDamageOnStun: 5 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.enemyHealth).toBe(25);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "nature", amount: 5 });
  });

  it("thunderstone damage does not generate combat text when texts omitted", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      trinketEffects: { ...baseState().trinketEffects, thunderstoneDamageOnStun: 5 },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyHealth).toBe(25);
  });

  it("applies lucky clover gold from thunderstone even when texts are omitted", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0);
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      trinketEffects: {
        ...baseState().trinketEffects,
        thunderstoneDamageOnStun: 5,
        luckyCloverGoldChance: 100,
      },
    });

    const result = resolveStunTrigger(state);

    expect(result.gold).toBe(5);
  });

  it("uses stunThresholdReduction to lower threshold", () => {
    const base = baseState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...base.enemyStatuses, stun: 10 },
      talentEffects: { ...base.talentEffects, stunThresholdReduction: 0.2 },
    };
    const result = resolveStunTrigger(state);
    expect(result.enemyStunSkipTurns).toBe(1);
  });

  it("CC immunity suppresses second stun trigger within cooldown", () => {
    const base = baseState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyCCCooldown: 0,
      enemyStatuses: { ...base.enemyStatuses, stun: 20 },
    };
    const result = resolveStunTrigger(state);
    expect(result.enemyStunSkipTurns).toBe(1);
    expect(result.enemyCCCooldown).toBe(2);

    // Second trigger with cooldown active: clears stun but no extra skip.
    const state2 = { ...result, enemyCCCooldown: 1, enemyStatuses: { ...result.enemyStatuses, stun: 20 } };
    const result2 = resolveStunTrigger(state2);
    expect(result2.enemyStunSkipTurns).toBe(1); // unchanged
    expect(result2.enemyStatuses.stun).toBe(0);
  });

  it("grants block on stun with blockOnStun talent", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      talentEffects: { ...baseState().talentEffects, blockOnStun: 3 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.block).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 3 });
  });

  it("grants forge on stun with forgeOnStun talent", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      talentEffects: { ...baseState().talentEffects, forgeOnStun: 2 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.forge).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 2 });
  });

  it("triggers forge burn burst when forgeOnStun crosses threshold", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      playerStatuses: { ...baseState().playerStatuses, forge: 3 },
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      talentEffects: {
        ...baseState().talentEffects,
        forgeOnStun: 2,
        forgeBurnThreshold: 4,
        forgeBurnDamage: 8,
      },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.forge).toBe(5);
    expect(result.enemyStatuses.burn).toBe(8);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 8 });
  });

  it("does not trigger forge burn burst when forge stays below threshold", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      playerStatuses: { ...baseState().playerStatuses, forge: 1 },
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      talentEffects: {
        ...baseState().talentEffects,
        forgeOnStun: 2,
        forgeBurnThreshold: 4,
        forgeBurnDamage: 8,
      },
    });
    const result = resolveStunTrigger(state);
    expect(result.playerStatuses.forge).toBe(3);
    expect(result.enemyStatuses.burn).toBe(0);
  });

  it("strips enemy armor on stun with stunStripArmor talent", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0 },
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      talentEffects: { ...baseState().talentEffects, stunStripArmor: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("stunStripArmor does nothing when enemy has no armor", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0 },
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      talentEffects: { ...baseState().talentEffects, stunStripArmor: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("restores mana on stun with manaOnStun talent", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      mana: 2,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...baseState().enemyStatuses, stun: 20 },
      talentEffects: { ...baseState().talentEffects, manaOnStun: 1 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.mana).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 1 });
  });
});

// ─── applyDamageStatuses ───

describe("applyDamageStatuses", () => {
  it("burn adds to enemy burn stack", () => {
    const state = baseState();
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 7, []);
    expect(result.enemyStatuses.burn).toBe(7);
  });

  it("burn removes enemy armor with burnRemovesEnemyArmor", () => {
    const state = baseState({
      enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0 },
      talentEffects: { ...baseState().talentEffects, burnRemovesEnemyArmor: true },
    });
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it("burn removes armor but not below 0", () => {
    const state = baseState({
      enemyMitigation: { armor: 2, forge: 0, freezeBonus: 0 },
      talentEffects: { ...baseState().talentEffects, burnRemovesEnemyArmor: true },
    });
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("poison adds to enemy poison stack", () => {
    const state = baseState();
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 4, []);
    expect(result.enemyStatuses.poison).toBe(4);
  });

  it("poison grants goldOnFirstPoison on first hit", () => {
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, goldOnFirstPoison: 8 },
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 3, texts);
    expect(result.gold).toBe(8);
    expect(result.flags.goldOnFirstPoisonThisCombat).toBe(true);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 8 });
  });

  it("poison grants goldOnFirstPoison only once", () => {
    const state = baseState({
      gold: 10,
      talentEffects: { ...baseState().talentEffects, goldOnFirstPoison: 8 },
      flags: { ...baseState().flags, goldOnFirstPoisonThisCombat: true },
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.gold).toBe(10);
  });

  it("bleed adds 2x status to bleed stack", () => {
    const state = baseState();
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.enemyStatuses.bleed).toBe(10);
  });

  it("bleed with lifesteal adds pending bleed leech healing", () => {
    const state = baseState();
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5, lifesteal: true };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.pendingBleedLeechHealing).toBe(10);
  });

  it("cutpurseGoldOnBleed grants gold on bleed", () => {
    const state = baseState({
      trinketEffects: { ...baseState().trinketEffects, cutpurseGoldOnBleed: 2 },
    });
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 5, texts);
    expect(result.gold).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 2 });
  });

  it("stun adds to stun stack and triggers resolveStunTrigger", () => {
    const base = baseState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...base.enemyStatuses, stun: 15 },
    };
    const effect = { kind: "damage" as const, damageType: "stun" as const, amount: 5 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 5, texts);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyStunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("freeze adds to freeze stack", () => {
    const state = baseState();
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.enemyStatuses.freeze).toBe(3);
  });

  it("freeze triggers skip when above threshold", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { ...baseState().enemyStatuses, freeze: 15 },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyStatuses.freeze).toBe(0);
    expect(result.enemyFreezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" });
  });

  it("freeze skip adds freezeDurationExtension", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { ...baseState().enemyStatuses, freeze: 15 },
      trinketEffects: { ...baseState().trinketEffects, freezeDurationExtension: 2 },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const result = applyDamageStatuses(state, effect, 10, []);
    expect(result.enemyFreezeSkipTurns).toBe(3);
  });

  it("freeze triggers frozenHeartDamage on skip", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { ...baseState().enemyStatuses, freeze: 15 },
      trinketEffects: { ...baseState().trinketEffects, frozenHeartDamage: 6 },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyHealth).toBe(24);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 6 });
  });

  it("freeze CC immunity suppresses second freeze trigger within cooldown", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCCCooldown: 0,
      enemyStatuses: { ...baseState().enemyStatuses, freeze: 15 },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyFreezeSkipTurns).toBe(1);
    expect(result.enemyCCCooldown).toBe(2);

    // Second trigger with cooldown: clear freeze but no extra skip.
    const state2 = { ...result, enemyCCCooldown: 1, enemyStatuses: { ...result.enemyStatuses, freeze: 15 } };
    const result2 = applyDamageStatuses(state2, effect, 10, []);
    expect(result2.enemyFreezeSkipTurns).toBe(1); // unchanged
    expect(result2.enemyStatuses.freeze).toBe(0);
  });

  it("freeze does not trigger on glacial-shell enemies", () => {
    const state = baseState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { ...baseState().enemyStatuses, freeze: 15 },
      currentEnemy: {
        id: "ice-golem",
        title: "Ice Golem",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "glacial-shell", title: "Glacial Shell", description: "Freeze immune" }],
        attackEffects: [],
      },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const result = applyDamageStatuses(state, effect, 10, []);
    expect(result.enemyStatuses.freeze).toBe(25);
    expect(result.enemyFreezeSkipTurns).toBe(0);
  });
});

// ─── removeHarmfulPlayerStatuses ───

describe("removeHarmfulPlayerStatuses", () => {
  it("removes statuses in priority order", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, burn: 5, poison: 3, bleed: 2 },
    });
    const result = removeHarmfulPlayerStatuses(state, 2);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.bleed).toBe(2);
  });

  it("does not heal with sinEater trinket when not owned", () => {
    const state = baseState({
      playerHealth: 20,
      playerStatuses: { ...baseState().playerStatuses, burn: 5 },
    });
    const result = removeHarmfulPlayerStatuses(state, 1);
    expect(result.playerHealth).toBe(20);
  });

  it("heals with sinEater trinket on remove", () => {
    const state = baseState({
      playerHealth: 20,
      playerStatuses: { ...baseState().playerStatuses, burn: 5, poison: 3 },
      trinketEffects: { ...baseState().trinketEffects, sinEaterHealOnHarmfulStatusRemove: 4 },
    });
    const texts = makeTexts();
    const result = removeHarmfulPlayerStatuses(state, 2, texts);
    // sinEaterHealOnHarmfulStatusRemove heals once for the batch, not per status
    expect(result.playerHealth).toBe(24);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 4 });
  });

  it("does nothing when no statuses to remove", () => {
    const state = baseState({
      playerHealth: 20,
      trinketEffects: { ...baseState().trinketEffects, sinEaterHealOnHarmfulStatusRemove: 4 },
    });
    const result = removeHarmfulPlayerStatuses(state, 1);
    expect(result.playerHealth).toBe(20);
  });

  it("heals and emits overheal block text when status cleanse heals above max health", () => {
    const state = baseState({
      playerHealth: 28,
      playerMaxHealth: 30,
      playerStatuses: { ...baseState().playerStatuses, burn: 5, block: 2 },
      talentEffects: {
        ...baseState().talentEffects,
        healOnStatusCleanse: 10,
        overhealToBlockRatio: 0.5,
      },
    });
    const texts = makeTexts();
    // cleanses burn, triggers healOnStatusCleanse(10) -> overheal = 8 -> block gained = round(8 * 0.5) = 4.
    const result = removeHarmfulPlayerStatuses(state, 1, texts);
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(6);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 10 });
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 4 });
  });
});

// ─── applyPlayerStatusEffect ───

describe("applyPlayerStatusEffect", () => {
  it("adds the status amount to player", () => {
    const state = baseState();
    const effect = { kind: "player-status" as const, status: "block" as const, amount: 5 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("doubles armor when player is below half health and armorDoubledBelowHalfHealth is active", () => {
    const state = baseState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...baseState().talentEffects, armorDoubledBelowHalfHealth: true },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(8);
  });

  it("doubles armor on first armor card when firstArmorCardDoubled is active", () => {
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, firstArmorCardDoubled: true },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(8);
    expect(result.flags.firstArmorCardDoubledUsed).toBe(true);
  });

  it("does not double armor on second armor card when flag is used", () => {
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, firstArmorCardDoubled: true },
      flags: { ...baseState().flags, firstArmorCardDoubledUsed: true },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(4);
  });

  it("grants block when armor crosses armorBlockThreshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, armor: 3 },
      talentEffects: { ...baseState().talentEffects, armorBlockThreshold: 5, armorBlockAmount: 3 },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.armor).toBe(6);
    expect(result.playerStatuses.block).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 3 });
  });

  it("does not grant block when armor does not cross threshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, armor: 1 },
      talentEffects: { ...baseState().talentEffects, armorBlockThreshold: 5, armorBlockAmount: 3 },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(4);
    expect(result.playerStatuses.block).toBe(0);
  });

  it("adds forge amount to block when forgeToBlock is active", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 3 },
      talentEffects: { ...baseState().talentEffects, forgeToBlock: true },
    });
    const effect = { kind: "player-status" as const, status: "block" as const, amount: 5 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.block).toBe(8);
  });

  it("applies forge burn burst when forge crosses threshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 3 },
      talentEffects: { ...baseState().talentEffects, forgeBurnThreshold: 5, forgeBurnDamage: 4 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(6);
    expect(result.enemyStatuses.burn).toBe(4);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 4 });
  });

  it("does not apply forge burn burst when below threshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 1 },
      talentEffects: { ...baseState().talentEffects, forgeBurnThreshold: 5, forgeBurnDamage: 4 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(4);
    expect(result.enemyStatuses.burn).toBe(0);
  });

  it("flatForgeGained increases forge from card effects", () => {
    const state = baseState({
      talentEffects: { ...baseState().talentEffects, flatForgeGained: 1 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("forgeDoubledBelowHalfHealth doubles forge gain when health is low", () => {
    const state = baseState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...baseState().talentEffects, forgeDoubledBelowHalfHealth: true },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("forgeDoubledBelowHalfHealth does not double when health is above 50%", () => {
    const state = baseState({
      playerHealth: 20,
      playerMaxHealth: 30,
      talentEffects: { ...baseState().talentEffects, forgeDoubledBelowHalfHealth: true },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("strips enemy armor when forge crosses forgeStripArmorThreshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 5 },
      enemyMitigation: { armor: 4, forge: 0, freezeBonus: 0 },
      talentEffects: { ...baseState().talentEffects, forgeStripArmorThreshold: 6 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("does not strip enemy armor when forge does not cross threshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 3 },
      enemyMitigation: { armor: 4, forge: 0, freezeBonus: 0 },
      talentEffects: { ...baseState().talentEffects, forgeStripArmorThreshold: 6 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(5);
    expect(result.enemyMitigation.armor).toBe(4);
  });

  it("grants block when forge crosses forgeBlockThreshold", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 5 },
      talentEffects: { ...baseState().talentEffects, forgeBlockThreshold: 6, forgeBlockAmount: 10 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.playerStatuses.block).toBe(10);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 10 });
  });

  it("forgeBlockBurst respects forgeToBlock synergy", () => {
    const state = baseState({
      playerStatuses: { ...baseState().playerStatuses, forge: 5 },
      talentEffects: { ...baseState().talentEffects, forgeToBlock: true, forgeBlockThreshold: 6, forgeBlockAmount: 10 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.playerStatuses.block).toBe(17);
  });

  it("flatForgeGained and forgeDoubledBelowHalfHealth stack together", () => {
    const state = baseState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...baseState().talentEffects, flatForgeGained: 1, forgeDoubledBelowHalfHealth: true },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(6);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 6 });
  });
});
