import { describe, expect, it } from "vitest";
import { getHoverId, getPlayerStatusChips, getEnemyStatusChips, getBattleCardPlayTarget, randomBetween, sampleItems, tokenizeDescription, getCombatTextColorClass, getCombatTextIcon } from "@/features/alchemy/utils";
import type { BattleState } from "@/lib/battle/types";

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    deck: [], hand: [], discard: [], exhausted: [], mana: 0, maxMana: 0, gold: 0,
    turn: 1, turnPhase: "player", playerHealth: 30, playerMaxHealth: 30, deathsDoorUsed: false, deathsDoorActive: false, deathsDoorTriggeredTurn: null,
    enemyHealth: 30, enemyMaxHealth: 30,
    enemyAttackEffects: [], enemyArmor: 0, enemyForge: 0, enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 },
    enemyStunSkipTurns: 0, enemyFreezeSkipTurns: 0, wishOptions: null, activeCompanion: null,
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
      removeCardDiscount: 0, enemyGoldDropBonus: 0, goldOnWish: 0, mixPotionDiscount: 0,
      holyLifestealPercent: 0, firstHolyCardFree: false, holyGoldPercent: 0, holyBurnChance: 0,
      receiveHalfHolyDamage: false, holyBlockPercent: 0, holyWishChance: 0, holyBlockPercentFromDamage: 0,
      holyVsBurnMultiplier: 0,
      goldOnWishAmount: 0, wishUndiscoveredCards: false, healthOnWish: 0, removeAilmentOnWish: false,
      wishExtraChoiceChance: 0, wishDrawsCard: false,
      firstPoisonCardFree: false, poisonPhysicalBonus: 0, poisonGainChance: 0, receiveHalfPoisonDamage: false,
      goldOnFirstPoison: 0, poisonHalvesHealing: false,
      firstBleedCardFree: false, bleedPhysicalBonus: 0, bleedLeechChance: 0, bleedEnemyDamageReduction: 0,
      bleedPhysicalTakenBonus: 0, bleedExecuteThreshold: 0, bleedDesperateMultiplier: 1, bleedPoisonChance: 0,
    },
    trinketEffects: {
      extraDrawPerBattle: 0, firstHolyDamageBonus: 0, firstBurnDoubled: false, boneCharmHealOnKill: 0,
      forgeStunThreshold: 0, forgeStunAmount: 0, frozenHeartDamage: 0, blockToArmorThreshold: 0,
      blockToArmorAmount: 0, runicQuillDrawOnConsume: 0, sinEaterGoldOnAilmentRemove: 0,
      vanguardCrestForgeOnBlockAbsorb: 0, parasiticBloomHealPerPoisonTick: 0, cutpurseGoldOnBleed: 0,
      wishingWellGoldOnWish: 0, plagueDoctorImmunity: false, mortarPestleFreeFirstPotion: false,
      sunderingArmorPiercing: 0, resonantChimeCardsRequired: 0, resonantChimeMana: 0,
      smugglersMapGoldBonus: 0, grovesFavorStartHeal: 0,
    },
    flags: {
      firstPhysicalCardFreeUsed: false, firstHolyCardFreeUsed: false, firstBurnCardDoubledUsed: false,
      firstArmorCardDoubledUsed: false, firstPoisonCardFreeUsed: false, firstBleedCardFreeUsed: false,
      nextCardCostReduction: 0, goldOnFirstPoisonThisCombat: false, firstHolyDamageBonusUsed: false,
      firstBurnTrinketDoubledUsed: false, firstAilmentPrevented: false, firstPotionFreeUsed: false,
      boneCharmUsed: false, resonantChimeUsedThisTurn: false,
    },
    discoveredCardIds: [],
    cardsPlayedThisTurn: 0,
    nextCardUid: 0,
    ...overrides,
  };
}

describe("getHoverId", () => {
  it("combines scope and cardId", () => expect(getHoverId("hand", "card-1")).toBe("hand-card-1"));
});

describe("getPlayerStatusChips", () => {
  it("returns only statuses with positive values, in order", () => {
    const state = makeState({ playerStatuses: { block: 5, forge: 2, burn: 3, armor: 0, haste: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 } });
    const chips = getPlayerStatusChips(state);
    expect(chips).toEqual([{ id: "block", value: 5 }, { id: "forge", value: 2 }, { id: "burn", value: 3 }]);
  });

  it("returns empty array when no statuses", () => {
    expect(getPlayerStatusChips(makeState())).toEqual([]);
  });
});

describe("getEnemyStatusChips", () => {
  it("returns enemy statuses with positive values", () => {
    const state = makeState({ enemyStatuses: { burn: 4, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 1 } });
    const chips = getEnemyStatusChips(state);
    expect(chips).toEqual([{ id: "burn", value: 4 }, { id: "stun", value: 1 }]);
  });
});

describe("getBattleCardPlayTarget", () => {
  function card(overrides = {}) {
    return { id: "c", title: "T", descriptionLines: [""], art: "", cost: 1, template: "mechanical" as const, effects: [], ...overrides };
  }

  it("returns 'enemy' for damage cards", () => {
    expect(getBattleCardPlayTarget(card({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }))).toBe("enemy");
  });

  it("returns 'player' for heal cards", () => {
    expect(getBattleCardPlayTarget(card({ effects: [{ kind: "heal", amount: 5 }] }))).toBe("player");
  });

  it("returns 'player' for status cards", () => {
    expect(getBattleCardPlayTarget(card({ effects: [{ kind: "player-status", status: "block", amount: 5 }] }))).toBe("player");
  });
});

describe("randomBetween", () => {
  it("returns a number within the range", () => {
    for (let i = 0; i < 100; i++) {
      const n = randomBetween(5, 10);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(10);
    }
  });
});

describe("sampleItems", () => {
  it("returns the requested count of items", () => {
    const items = [1, 2, 3, 4, 5];
    const result = sampleItems(items, 3);
    expect(result).toHaveLength(3);
  });

  it("returns all items if count exceeds array length", () => {
    expect(sampleItems([1, 2], 5)).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(sampleItems([], 3)).toEqual([]);
  });
});

describe("tokenizeDescription", () => {
  it("returns plain text when no keyword matches", () => {
    expect(tokenizeDescription("Deal 5 damage")).toEqual([{ text: "Deal 5 damage" }]);
  });

  it("highlights matched keywords with keywordId", () => {
    const result = tokenizeDescription("Deal 5 Physical damage");
    expect(result).toContainEqual({ text: "Physical", keywordId: "physical" });
  });

  it("handles multiple keyword matches", () => {
    const result = tokenizeDescription("Physical and Burn damage");
    const kwIds = result.filter((p) => "keywordId" in p).map((p) => (p as { keywordId: string }).keywordId);
    expect(kwIds).toContain("physical");
    expect(kwIds).toContain("burn");
  });
});

describe("getCombatTextColorClass", () => {
  it("returns red for health damage", () => {
    expect(getCombatTextColorClass({ target: "player", kind: "damage", stat: "health", amount: 5 })).toBe("text-red-400");
  });

  it("returns type color for damage by type", () => {
    expect(getCombatTextColorClass({ target: "enemy", kind: "damage", stat: "burn", amount: 5 })).toBe("text-orange-400");
  });

  it("returns green for heals", () => {
    expect(getCombatTextColorClass({ target: "player", kind: "heal", stat: "health", amount: 5 })).toBe("text-green-400");
  });
});

describe("getCombatTextIcon", () => {
  it("returns HeartPulse for heal", () => {
    const icon = getCombatTextIcon({ target: "player", kind: "heal", stat: "health", amount: 5 });
    expect(icon).toBeDefined();
  });

  it("returns the stat's icon for damage", () => {
    const icon = getCombatTextIcon({ target: "enemy", kind: "damage", stat: "burn", amount: 5 });
    expect(icon).toBeDefined();
  });
});
