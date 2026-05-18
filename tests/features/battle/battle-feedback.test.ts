import { describe, expect, it } from "vitest";
import { shouldPlayCardGoldGain, shouldShakeEnemyFromCombatTexts, shouldShakePlayerFromCombatTexts } from "@/features/alchemy/battle/battle-feedback";
import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { defaultTalentEffects } from "@/lib/battle/draw";
import { defaultTrinketEffects } from "@/lib/trinkets";

function makeState(): BattleState {
  return {
    deck: [], hand: [], discard: [], exhausted: [], mana: 0, maxMana: 0, gold: 0,
    turn: 1, turnPhase: "player", playerHealth: 30, playerMaxHealth: 30, deathsDoorUsed: false, deathsDoorActive: false, deathsDoorTriggeredTurn: null, enemyHealth: 30,
    enemyMaxHealth: 30, enemyAttackEffects: [], enemyArmor: 0, enemyForge: 0, enemyFreezeBonus: 0, enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    pendingBleedLeechHealing: 0,
    enemyStunSkipTurns: 0, enemyFreezeSkipTurns: 0, wishOptions: null, wishQueue: [], activeCompanion: null,
    currentEnemy: { id: "skeleton", title: "Skeleton", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [], attackEffects: [] },
    talentEffects: defaultTalentEffects,
    trinketEffects: defaultTrinketEffects,
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
  };
}

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "test-card", title: "Test", descriptionLines: [""], art: "", cost: 1, effects: [], ...overrides };
}

describe("shouldPlayCardGoldGain", () => {
  it("returns true when gold increased and card is not steal", () => {
    const prev = makeState(); prev.gold = 5; const next = makeState(); next.gold = 8;
    expect(shouldPlayCardGoldGain(prev, next, makeCard({ id: "strike" }))).toBe(true);
  });

  it("returns false when gold unchanged", () => {
    const prev = makeState(); prev.gold = 5; const next = makeState(); next.gold = 5;
    expect(shouldPlayCardGoldGain(prev, next, makeCard())).toBe(false);
  });

  it("returns false when gold decreased", () => {
    const prev = makeState(); prev.gold = 10; const next = makeState(); next.gold = 5;
    expect(shouldPlayCardGoldGain(prev, next, makeCard())).toBe(false);
  });

  it("returns false for steal card even if gold increased", () => {
    const prev = makeState(); prev.gold = 0; const next = makeState(); next.gold = 10;
    expect(shouldPlayCardGoldGain(prev, next, makeCard({ id: "steal" }))).toBe(false);
  });
});

describe("shouldShakeEnemyFromCombatTexts", () => {
  it("returns true when any combat text damages enemy", () => {
    expect(shouldShakeEnemyFromCombatTexts([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }])).toBe(true);
  });

  it("returns false when no enemy damage events", () => {
    expect(shouldShakeEnemyFromCombatTexts([{ target: "player", kind: "damage", stat: "physical", amount: 5 }])).toBe(false);
  });

  it("returns false for player status events only", () => {
    expect(shouldShakeEnemyFromCombatTexts([{ target: "player", kind: "status", stat: "block", amount: 5 }])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(shouldShakeEnemyFromCombatTexts([])).toBe(false);
  });
});

describe("shouldShakePlayerFromCombatTexts", () => {
  it("returns true when any combat text damages player", () => {
    expect(shouldShakePlayerFromCombatTexts([{ target: "player", kind: "damage", stat: "physical", amount: 5 }])).toBe(true);
  });

  it("returns false when no player damage events", () => {
    expect(shouldShakePlayerFromCombatTexts([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }])).toBe(false);
  });

  it("returns false for player heal events only", () => {
    expect(shouldShakePlayerFromCombatTexts([{ target: "player", kind: "heal", stat: "health", amount: 5 }])).toBe(false);
  });

  it("returns true for player burn damage", () => {
    expect(shouldShakePlayerFromCombatTexts([{ target: "player", kind: "damage", stat: "burn", amount: 3 }])).toBe(true);
  });

  it("returns false for empty array", () => {
    expect(shouldShakePlayerFromCombatTexts([])).toBe(false);
  });
});
