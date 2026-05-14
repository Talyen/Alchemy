import { describe, expect, it } from "vitest";
import { getEffectiveCost } from "@/lib/battle/cost";
import { defaultTalentEffects } from "@/lib/battle/draw";
import { defaultTrinketEffects } from "@/lib/trinkets";
import type { BattleState, CombatFlags } from "@/lib/battle/types";
import type { BattleCard } from "@/lib/game-data";

const defaultFlags: CombatFlags = {
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
  boneCharmUsed: false,
  resonantChimeUsedThisTurn: false,
};

function makeState(flags: Partial<CombatFlags> = {}, talentOverrides: Record<string, unknown> = {}): BattleState {
  return {
    deck: [], hand: [], discard: [], exhausted: [], mana: 5, maxMana: 5, gold: 0,
    turn: 1, turnPhase: "player", playerHealth: 30, playerMaxHealth: 30, deathsDoorUsed: false, deathsDoorActive: false, deathsDoorTriggeredTurn: null, enemyHealth: 30,
    enemyMaxHealth: 30, enemyAttackEffects: [], enemyArmor: 0, enemyForge: 0, enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 },
    enemyStunSkipTurns: 0, enemyFreezeSkipTurns: 0, wishOptions: null, wishQueue: [], activeCompanion: null,
    currentEnemy: { id: "skeleton", title: "Skeleton", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [], attackEffects: [] },
    talentEffects: { ...defaultTalentEffects, ...talentOverrides },
    trinketEffects: defaultTrinketEffects,
    flags: { ...defaultFlags, ...flags },
    discoveredCardIds: [],
    cardsPlayedThisTurn: 0,
    nextCardUid: 0,
  };
}

function physicalCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "test", title: "Test", descriptionLines: [""], art: "", cost: 2, effects: [{ kind: "damage", damageType: "physical", amount: 5 }], ...overrides };
}

function holyCard(): BattleCard {
  return { id: "holy", title: "Holy", descriptionLines: [""], art: "", cost: 2, effects: [{ kind: "damage", damageType: "holy", amount: 5 }] };
}

function poisonCard(): BattleCard {
  return { id: "poison", title: "Poison", descriptionLines: [""], art: "", cost: 2, effects: [{ kind: "damage", damageType: "poison", amount: 2 }] };
}

function bleedCard(): BattleCard {
  return { id: "bleed", title: "Bleed", descriptionLines: [""], art: "", cost: 2, effects: [{ kind: "damage", damageType: "bleed", amount: 2 }] };
}

describe("getEffectiveCost", () => {
  it("returns base cost when no modifiers active", () => {
    const state = makeState();
    expect(getEffectiveCost(state, physicalCard())).toBe(2);
  });

  it("reduces cost by nextCardCostReduction", () => {
    const state = makeState({ nextCardCostReduction: 1 });
    expect(getEffectiveCost(state, physicalCard())).toBe(1);
  });

  it("does not reduce cost below 0 with nextCardCostReduction", () => {
    const state = makeState({ nextCardCostReduction: 5 });
    expect(getEffectiveCost(state, physicalCard())).toBe(0);
  });

  it("makes first physical card free when talent is active and flag not used", () => {
    const state = makeState({ firstPhysicalCardFreeUsed: false }, { firstPhysicalCardFree: true });
    expect(getEffectiveCost(state, physicalCard())).toBe(0);
  });

  it("does not make non-first physical card free when flag is already used", () => {
    const state = makeState({ firstPhysicalCardFreeUsed: true }, { firstPhysicalCardFree: true });
    expect(getEffectiveCost(state, physicalCard())).toBe(2);
  });

  it("makes first holy card free when talent is active", () => {
    const state = makeState({ firstHolyCardFreeUsed: false }, { firstHolyCardFree: true });
    expect(getEffectiveCost(state, holyCard())).toBe(0);
  });

  it("makes first poison card free when talent is active", () => {
    const state = makeState({ firstPoisonCardFreeUsed: false }, { firstPoisonCardFree: true });
    expect(getEffectiveCost(state, poisonCard())).toBe(0);
  });

  it("makes first bleed card free when talent is active", () => {
    const state = makeState({ firstBleedCardFreeUsed: false }, { firstBleedCardFree: true });
    expect(getEffectiveCost(state, bleedCard())).toBe(0);
  });

  it("does not make a card free if it lacks the matching damage type", () => {
    const state = makeState({}, { firstPhysicalCardFree: true, firstHolyCardFree: true });
    const card = { ...physicalCard(), effects: [{ kind: "heal", amount: 5 }] };
    expect(getEffectiveCost(state, card)).toBe(2);
  });

  it("honors nextCardCostReduction even when first-card-free is already used", () => {
    const state = makeState({ firstPhysicalCardFreeUsed: true, nextCardCostReduction: 1 }, { firstPhysicalCardFree: true });
    expect(getEffectiveCost(state, physicalCard())).toBe(1);
  });

  it("stacks nextCardCostReduction with first-card-free (free wins)", () => {
    const state = makeState({ firstPhysicalCardFreeUsed: false, nextCardCostReduction: 1 }, { firstPhysicalCardFree: true });
    expect(getEffectiveCost(state, physicalCard())).toBe(0);
  });
});
