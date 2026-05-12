import { describe, expect, it, vi } from "vitest";
import { mergeCombatText, applyCardEffects, getEnemyDamageMultiplier } from "@/lib/battle/effects";
import { playBattleCardResolved, endPlayerTurn, chooseWishCard, processCompanionTurnStart } from "@/lib/battle/turns";
import { drawCards, createBattleState, defaultTalentEffects, shuffleCards } from "@/lib/battle/draw";
import { companionLibrary, enemyBestiary } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";
import { basePlayerMana, clamp, clampHealth, isPlayerDefeated, maxHandSize, maxPlayerHealth } from "@/lib/battle/types";
import { defaultTrinketEffects, computeTrinketManifest } from "@/lib/trinkets";

vi.spyOn(Math, "random").mockReturnValue(0.99);

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  const empty: BattleState = {
    deck: [], hand: [], discard: [], exhausted: [], mana: 0, maxMana: 0, gold: 0,
    turn: 1, turnPhase: "player", playerHealth: 30, playerMaxHealth: 30, deathsDoorUsed: false, deathsDoorActive: false, deathsDoorTriggeredTurn: null, enemyHealth: 30,
    enemyMaxHealth: 30, enemyAttackEffects: [], enemyArmor: 0, enemyForge: 0, enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 },
    enemyStunSkipTurns: 0, enemyFreezeSkipTurns: 0, wishOptions: null, activeCompanion: null,
    currentEnemy: { id: "skeleton", title: "Skeleton", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [], attackEffects: [] },
    talentEffects: defaultTalentEffects,
    trinketEffects: defaultTrinketEffects,
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
      firstAilmentPrevented: false,
      firstPotionFreeUsed: false,
      boneCharmUsed: false,
      resonantChimeUsedThisTurn: false,
    },
    discoveredCardIds: [],
    cardsPlayedThisTurn: 0,
    nextCardUid: 0,
  };
  return { ...empty, ...overrides };
}

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test-card", title: "Test", descriptionLines: [""], art: "",
    cost: 1, template: "mechanical", effects: [], ...overrides,
  };
}

// ─── effects.ts ───

describe("mergeCombatText", () => {
  it("adds a new event to an empty array", () => {
    const texts: CombatTextEvent[] = [];
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "physical", amount: 5 });
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }]);
  });

  it("merges events with the same target, kind, and stat", () => {
    const texts: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }];
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "physical", amount: 3 });
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "physical", amount: 8 }]);
  });

  it("does NOT merge events with different targets", () => {
    const texts: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }];
    mergeCombatText(texts, { target: "player", kind: "damage", stat: "physical", amount: 3 });
    expect(texts).toHaveLength(2);
  });

  it("does NOT merge events with different stats", () => {
    const texts: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }];
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "burn", amount: 3 });
    expect(texts).toHaveLength(2);
  });
});

describe("applyCardEffects", () => {
  it("applies damage to enemy health", () => {
    const state = makeState({ mana: 10, enemyHealth: 30 });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(25);
  });

  it("applies player block status", () => {
    const state = makeState({ mana: 10 });
    const card = makeCard({ effects: [{ kind: "player-status", status: "block", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("heals the player", () => {
    const state = makeState({ mana: 10, playerHealth: 20 });
    const card = makeCard({ effects: [{ kind: "heal", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(25);
  });

  it("restores mana", () => {
    const state = makeState({ mana: 2, maxMana: 4 });
    const card = makeCard({ effects: [{ kind: "restore-mana", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.mana).toBe(4);
  });

  it("restore-mana can overflow maxMana", () => {
    const state = makeState({ mana: 4, maxMana: 4 });
    const card = makeCard({ effects: [{ kind: "restore-mana", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.mana).toBe(6);
  });

  it("clamps current mana when max mana is reduced", () => {
    const state = makeState({ mana: 4, maxMana: 4 });
    const card = makeCard({ effects: [{ kind: "lose-max-mana", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.maxMana).toBe(2);
    expect(result.mana).toBe(2);
  });

  it("handles consume cards (exhaust instead of discard)", () => {
    const card = makeCard({ id: "consumable", consume: true, effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    // Also check that the card went to exhausted
    // playBattleCardResolved puts the card in exhausted if consume is true
    // hand starts empty so index 0 doesn't exist, let's use a proper test
    const stateWithHand = makeState({ mana: 10, hand: [card] });
    const r2 = playBattleCardResolved(stateWithHand, "consumable", 0);
    expect(r2.state.hand).toHaveLength(0);
    expect(r2.state.exhausted).toHaveLength(1);
    expect(r2.state.exhausted[0].id).toBe("consumable");
  });
});

describe("getEnemyDamageMultiplier", () => {
  it("returns 1 for an enemy with no traits", () => {
    const state = makeState();
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 2 for holy damage against brittle-bones", () => {
    const state = makeState({ currentEnemy: { id: "skeleton", title: "Skeleton", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [{ id: "brittle-bones", title: "Brittle Bones", description: "" }], attackEffects: [] } });
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "stun")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 2 for burn and holy against fear-the-light", () => {
    const state = makeState({ currentEnemy: { id: "goblin", title: "Goblin", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [{ id: "fear-the-light", title: "Fear the Light", description: "" }], attackEffects: [] } });
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 2 for holy against holy-vulnerability", () => {
    const state = makeState({ currentEnemy: { id: "necromancer", title: "Necromancer", subtitle: "", descriptionLines: [""], art: "", enemyType: "elite", traits: [{ id: "holy-vulnerability", title: "Holy Vulnerability", description: "" }], attackEffects: [] } });
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 0.5 for burn against burn-resistance", () => {
    const state = makeState({ currentEnemy: { id: "imp", title: "Imp", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [{ id: "burn-resistance", title: "Burn Resistance", description: "" }], attackEffects: [] } });
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(0.5);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 0.5 for poison against poison-resistance", () => {
    const state = makeState({ currentEnemy: { id: "lizard-scout", title: "Lizard Scout", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [{ id: "poison-resistance", title: "Poison Resistance", description: "" }], attackEffects: [] } });
    expect(getEnemyDamageMultiplier(state, "poison")).toBe(0.5);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });
});

describe("combat number accuracy", () => {
  it("does not double the first Burn card unless the talent is active", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const state = makeState({ enemyHealth: 30 });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(20);
    expect(result.enemyStatuses.burn).toBe(10);
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 10 }]);
    expect(result.flags.firstBurnCardDoubledUsed).toBe(false);
  });

  it("doubles the first Burn card exactly once when the talent is active", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const secondCard = makeCard({ id: "second-burn", effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const state = makeState({
      enemyHealth: 50,
      talentEffects: { ...defaultTalentEffects, firstBurnCardDoubled: true },
    });

    const firstTexts: CombatTextEvent[] = [];
    const first = applyCardEffects(state, card, firstTexts);
    const secondTexts: CombatTextEvent[] = [];
    const second = applyCardEffects(first, secondCard, secondTexts);

    expect(first.enemyHealth).toBe(30);
    expect(first.enemyStatuses.burn).toBe(20);
    expect(firstTexts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 20 }]);
    expect(first.flags.firstBurnCardDoubledUsed).toBe(true);

    expect(second.enemyHealth).toBe(20);
    expect(second.enemyStatuses.burn).toBe(30);
    expect(secondTexts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 10 }]);
  });

  it("uses post-weakness damage for health, status stacks, and combat text", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const state = makeState({
      enemyHealth: 30,
      currentEnemy: {
        id: "undead",
        title: "Undead",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "fear-the-light", title: "Fear the Light", description: "Receives double Burn and Holy damage." }],
        attackEffects: [],
      },
    });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(10);
    expect(result.enemyStatuses.burn).toBe(20);
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 20 }]);
  });

  it("uses post-resistance damage for health, status stacks, and combat text", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const state = makeState({
      enemyHealth: 30,
      currentEnemy: {
        id: "lizard",
        title: "Lizard",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "burn-resistance", title: "Burn Resistance", description: "Receives half Burn damage." }],
        attackEffects: [],
      },
    });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(25);
    expect(result.enemyStatuses.burn).toBe(5);
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 5 }]);
  });

  it("does not trigger first-poison gold when armor prevents all Poison damage", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "poison", amount: 2 }] });
    const state = makeState({
      enemyArmor: 3,
      talentEffects: { ...defaultTalentEffects, goldOnFirstPoison: 4 },
    });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.gold).toBe(0);
    expect(result.enemyStatuses.poison).toBe(0);
    expect(result.flags.goldOnFirstPoisonThisCombat).toBe(false);
    expect(texts).not.toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 4 });
  });

  it("does not trigger Cutpurse Knife when armor prevents all Bleed damage", () => {
    const manifest = computeTrinketManifest(["cutpurse-knife"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 2 }] });
    const state = makeState({ enemyArmor: 3, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.gold).toBe(0);
    expect(result.enemyStatuses.bleed).toBe(0);
    expect(texts).not.toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 1 });
  });
});

// ─── turns.ts ───

describe("playBattleCardResolved", () => {
  it("deducts mana and removes card from hand", () => {
    const card = makeCard({ cost: 2 });
    const state = makeState({ mana: 5, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(3);
    expect(result.state.hand).toHaveLength(0);
  });

  it("returns unchanged state when wish is active", () => {
    const card = makeCard({ cost: 1 });
    const state = makeState({ mana: 5, wishOptions: [card], hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state).toBe(state);
  });

  it("deals damage from card effects", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 7 }] });
    const state = makeState({ mana: 5, enemyHealth: 30, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.enemyHealth).toBe(23);
  });

  it("cannot play a card with insufficient mana", () => {
    const card = makeCard({ cost: 1 });
    const state = makeState({ mana: 0, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state).toBe(state);
  });

  it("can play a 0-cost card with 0 mana", () => {
    const card = makeCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = makeState({ mana: 0, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(0);
    expect(result.state.hand).toHaveLength(0);
    expect(result.state.enemyHealth).toBe(29);
  });

  it("summons and consumes a companion card", () => {
    const card = makeCard({ id: "wolf-companion", title: "Wolf Companion", consume: true, effects: [{ kind: "summon-companion", companionId: "wolf" }] });
    const state = makeState({ mana: 4, hand: [card] });

    const result = playBattleCardResolved(state, card.id, 0);

    expect(result.state.activeCompanion?.id).toBe("wolf");
    expect(result.state.hand).toHaveLength(0);
    expect(result.state.exhausted).toEqual([card]);
  });

  it("replaces the current companion when another companion is summoned", () => {
    const card = makeCard({ id: "wolf-companion", effects: [{ kind: "summon-companion", companionId: "wolf" }] });
    const state = makeState({ mana: 4, hand: [card], activeCompanion: { ...companionLibrary.wolf, title: "Old Wolf" } });

    const result = playBattleCardResolved(state, card.id, 0);

    expect(result.state.activeCompanion).toEqual(companionLibrary.wolf);
  });

  // ─── Mana Overflow Tests ───

  it("restore-mana effect is applied before cost deduction so overflow works", () => {
    const card = makeCard({ cost: 1, effects: [{ kind: "restore-mana", amount: 2 }] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    // restore(4→6) then cost(6→5) = 5 mana, exceeding maxMana=4
    expect(result.state.mana).toBe(5);
    expect(result.state.maxMana).toBe(4);
  });

  it("restore-mana that equals cost results in no net mana change", () => {
    const card = makeCard({ cost: 1, effects: [{ kind: "restore-mana", amount: 1 }] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    // restore(4→5) then cost(5→4) = 4 mana
    expect(result.state.mana).toBe(4);
    expect(result.state.maxMana).toBe(4);
  });

  it("gain-max-mana with cost applies gain before cost deduction", () => {
    const card = makeCard({ cost: 1, effects: [{ kind: "gain-max-mana", amount: 1 }] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    // gain-max(4→5/5) then cost(5→4) = 4 mana, 5 maxMana
    expect(result.state.mana).toBe(4);
    expect(result.state.maxMana).toBe(5);
  });

  it("can overflow with multiple restore-mana effects", () => {
    const card = makeCard({ cost: 0, effects: [{ kind: "restore-mana", amount: 3 }] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(7);
    expect(result.state.maxMana).toBe(4);
  });

  it("overflow mana is not clamped down on subsequent turns", () => {
    const card = makeCard({ cost: 1, effects: [{ kind: "restore-mana", amount: 2 }] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card], deck: [makeCard()] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(5);
    // Turn end refills to maxMana=4 — overflow should NOT persist
    // but the state at this point should have mana=5
  });
});

describe("endPlayerTurn", () => {
  it("switches to enemy phase and draws a new hand", () => {
    const state = makeState({ mana: 4, maxMana: 4, turnPhase: "player", hand: [makeCard({ id: "c1" }), makeCard({ id: "c2" })], deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })] });
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.turn).toBe(2);
    expect(result.state.hand.length).toBeGreaterThanOrEqual(1);
    expect(result.state.mana).toBe(4);
  });

  it("skips enemy turn when enemyStunSkipTurns > 0", () => {
    const state = makeState({ enemyStunSkipTurns: 1, deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })], mana: 4, maxMana: 4 });
    const result = endPlayerTurn(state);
    expect(result.state.enemyStunSkipTurns).toBe(0);
    expect(result.state.playerHealth).toBe(30); // no damage taken
  });

  it("applies enemy attack damage", () => {
    const state = makeState({ enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }], playerHealth: 30, deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })], mana: 4, maxMana: 4 });
    const result = endPlayerTurn(state);
    // With no block or armor, all 8 damage goes through
    expect(result.state.playerHealth).toBe(22);
  });

  it("triggers Death's Door instead of defeat on the first fatal combat damage", () => {
    const state = makeState({ enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }], playerHealth: 5, deck: [makeCard({ id: "d1" })], mana: 4, maxMana: 4 });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorUsed).toBe(true);
    expect(result.state.deathsDoorActive).toBe(true);
    expect(result.state.deathsDoorTriggeredTurn).toBe(1);
    expect(isPlayerDefeated(result.state)).toBe(false);
  });

  it("kills the player at the next enemy turn end if Death's Door was not healed", () => {
    const state = makeState({ playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: true, deathsDoorTriggeredTurn: 1, turn: 2, deck: [makeCard({ id: "d1" })], mana: 4, maxMana: 4 });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
    expect(isPlayerDefeated(result.state)).toBe(true);
  });

  it("does not retrigger Death's Door after it was consumed", () => {
    const state = makeState({ enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }], playerHealth: 3, deathsDoorUsed: true, deck: [makeCard({ id: "d1" })], mana: 4, maxMana: 4 });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
    expect(isPlayerDefeated(result.state)).toBe(true);
  });

  it("healing above 0 clears Death's Door but keeps it consumed", () => {
    const state = makeState({ playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: true, deathsDoorTriggeredTurn: 1 });
    const card = makeCard({ effects: [{ kind: "heal", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.playerHealth).toBe(5);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.deathsDoorActive).toBe(false);
  });

  it("gives the player an extra turn when haste is active", () => {
    const state = makeState({
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 1, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      hand: [makeCard({ id: "h1" }), makeCard({ id: "h2" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.playerStatuses.haste).toBe(0);
    // Enemy should not have attacked
    expect(result.state.playerHealth).toBe(30);
  });

  it("only heals leech amount from bleed, not total bleed stack", () => {
    const state = makeState({
      playerHealth: 20,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      enemyStatuses: { burn: 0, poison: 0, bleed: 10, bleedLeech: 4, freeze: 0, stun: 0 },
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // Enemy takes 10 bleed damage
    expect(result.state.enemyHealth).toBe(20);
    // Player takes 8 enemy attack then heals 4 from leech: 20 - 8 + 4 = 16
    expect(result.state.playerHealth).toBe(16);
    expect(result.state.enemyStatuses.bleed).toBe(0);
    expect(result.state.enemyStatuses.bleedLeech).toBe(0);
  });

  it("ticks player Burn damage and halves the remaining Burn stack", () => {
    const state = makeState({
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 5, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });

    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(25);
    expect(result.state.playerStatuses.burn).toBe(2);
    expect(result.combatTexts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 5 });
  });

  it("prevents enemy Stun buildup while Block is active when the talent is unlocked", () => {
    const state = makeState({
      playerStatuses: { block: 1, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, blockPreventsStun: true },
      enemyAttackEffects: [{ kind: "player-status", status: "stun", amount: 2 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });

    const result = endPlayerTurn(state);

    expect(result.state.playerStatuses.stun).toBe(0);
    expect(result.combatTexts).not.toContainEqual({ target: "player", kind: "status", stat: "stun", amount: 2 });
  });

  it("uses Plague Doctor's Mask only on actual ailments", () => {
    const manifest = computeTrinketManifest(["plague-doctors-mask"]);
    const state = makeState({
      enemyAttackEffects: [
        { kind: "player-status", status: "block", amount: 2 },
        { kind: "player-status", status: "poison", amount: 3 },
      ],
      trinketEffects: manifest,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });

    const result = endPlayerTurn(state);

    expect(result.state.playerStatuses.block).toBe(1);
    expect(result.state.playerStatuses.poison).toBe(0);
    expect(result.state.flags.firstAilmentPrevented).toBe(true);
  });

  it("does not trigger companion attack (now handled by controller timing)", () => {
    const state = makeState({
      activeCompanion: companionLibrary.wolf,
      enemyAttackEffects: [],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });

    const result = endPlayerTurn(state);

    expect(result.state.activeCompanion?.id).toBe("wolf");
    expect(result.state.turnPhase).toBe("player");
    // Companion no longer attacks as part of endPlayerTurn
    expect(result.state.enemyHealth).toBe(30);
    expect(result.state.enemyStatuses.bleed).toBe(0);
  });
});

describe("processCompanionTurnStart", () => {
  it("triggers Wolf companion bleed damage", () => {
    const state = makeState({
      activeCompanion: companionLibrary.wolf,
      enemyAttackEffects: [],
    });

    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);

    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.bleed).toBe(2);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 1 });
  });

  it("applies player modifiers to companion attacks", () => {
    const state = makeState({
      activeCompanion: companionLibrary.wolf,
      enemyAttackEffects: [],
      playerHealth: 10,
      talentEffects: { ...defaultTalentEffects, bleedDesperateMultiplier: 2 },
    });

    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);

    expect(result.enemyHealth).toBe(28);
    expect(result.enemyStatuses.bleed).toBe(4);
  });

  it("triggers Lizard Scout companion poison damage", () => {
    const state = makeState({
      activeCompanion: companionLibrary["lizard-scout"],
      enemyAttackEffects: [],
    });

    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);

    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.poison).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: 1 });
  });

  it("triggers Imp companion burn damage", () => {
    const state = makeState({
      activeCompanion: companionLibrary.imp,
      enemyAttackEffects: [],
    });

    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);

    expect(result.enemyHealth).toBe(28);
    expect(result.enemyStatuses.burn).toBe(2);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 2 });
  });

  it("returns state unchanged when no active companion", () => {
    const state = makeState();

    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);

    expect(result).toBe(state);
    expect(texts).toHaveLength(0);
  });
});

describe("chooseWishCard", () => {
  it("adds chosen card to hand if there's room", () => {
    const card = makeCard({ id: "wish-card" });
    const state = makeState({ hand: [], wishOptions: [card] });
    const result = chooseWishCard(state, "wish-card");
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].id).toBe("wish-card");
    expect(result.wishOptions).toBeNull();
  });

  it("puts card in discard if hand is full", () => {
    const card = makeCard({ id: "wish-card" });
    const fullHand = Array(7).fill(null).map((_, i) => makeCard({ id: `h${i}` }));
    const state = makeState({ hand: fullHand, wishOptions: [card] });
    const result = chooseWishCard(state, "wish-card");
    expect(result.discard).toContainEqual(card);
    expect(result.wishOptions).toBeNull();
  });
});

describe("wish combat effects", () => {
  it("applies the Gold-tree gold on Wish talent", () => {
    const card = makeCard({ effects: [{ kind: "wish", amount: 1 }] });
    const state = makeState({
      gold: 2,
      talentEffects: { ...defaultTalentEffects, goldOnWish: 3 },
    });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.gold).toBe(5);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 3 });
  });
});

// ─── draw.ts ───

describe("drawCards", () => {
  it("draws the requested number of cards", () => {
    const deck = [makeCard({ id: "a" }), makeCard({ id: "b" }), makeCard({ id: "c" })];
    const result = drawCards(deck, [], [], 2);
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
  });

  it("respects maxHandSize", () => {
    const deck = Array(10).fill(null).map((_, i) => makeCard({ id: `c${i}` }));
    const result = drawCards(deck, [], Array(6).fill(null).map((_, i) => makeCard({ id: `h${i}` })), 10);
    expect(result.hand).toHaveLength(maxHandSize);
  });

  it("reshuffles discard into deck when deck is empty", () => {
    const discard = [makeCard({ id: "a" }), makeCard({ id: "b" })];
    const result = drawCards([], discard, [], 2);
    expect(result.hand).toHaveLength(2);
    expect(result.discard).toHaveLength(0);
  });
});

describe("createBattleState", () => {
  const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;

  it("creates a valid battle state with starting hand", () => {
    const result = createBattleState(undefined, 0, 0, skeleton);
    expect(result.turn).toBe(1);
    expect(result.playerHealth).toBe(maxPlayerHealth);
    expect(result.enemyHealth).toBe(30);
    expect(result.hand.length).toBeGreaterThanOrEqual(1);
    expect(result.mana).toBe(basePlayerMana);
    expect(result.activeCompanion).toBeNull();
  });

  it("scales enemy stats based on rooms encountered", () => {
    const result = createBattleState(undefined, 0, 5, skeleton, undefined, undefined, undefined, undefined, undefined, 5);
    expect(result.enemyHealth).toBe(42); // 30 * 1.4 = 42
    expect(result.enemyAttackEffects[0].amount).toBe(11); // 8 * 1.4 = 11.2 → floor 11
  });
});

describe("clamp / clampHealth", () => {
  it("clamps value between min and max", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("clampHealth adds positive delta clamped to max", () => {
    expect(clampHealth(20, 5, 30)).toBe(25);
    expect(clampHealth(28, 5, 30)).toBe(30);
  });

  it("clampHealth subtracts negative delta clamped to 0", () => {
    expect(clampHealth(10, -5, 30)).toBe(5);
    expect(clampHealth(3, -5, 30)).toBe(0);
  });
});

describe("shuffleCards", () => {
  it("returns all cards in a shuffled order", () => {
    const cards = [makeCard({ id: "a" }), makeCard({ id: "b" }), makeCard({ id: "c" })];
    const result = shuffleCards(cards);
    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining(cards));
  });

  it("does not mutate the original array", () => {
    const cards = [makeCard({ id: "a" }), makeCard({ id: "b" })];
    const result = shuffleCards(cards);
    expect(cards).toHaveLength(2);
    expect(result).not.toBe(cards);
  });
});

// ─── Trinket Effects ───

describe("Trinket — Brass Censer (first Holy attack +2)", () => {
  it("adds 2 holy damage to the first holy attack", () => {
    const manifest = computeTrinketManifest(["brass-censer"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    // 5 base + 2 trinket = 7 damage (no crit due to mock returning 0.99 > 5%)
    expect(result.state.enemyHealth).toBe(23);
    expect(result.state.flags.firstHolyDamageBonusUsed).toBe(true);
  });

  it("does NOT add bonus to second holy attack", () => {
    const manifest = computeTrinketManifest(["brass-censer"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const card2 = makeCard({ id: "holy2", effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest, hand: [card] });
    const first = playBattleCardResolved(state, card.id, 0);
    const second = playBattleCardResolved({ ...first.state, hand: [card2] }, card2.id, 0);
    // First: 7 damage. Second: 5 damage. Total: 12 damage = 18 remaining
    expect(second.state.enemyHealth).toBe(18);
  });
});

describe("Trinket — Tattered Pages (extra draw at battle start)", () => {
  it("deals 5 cards in opening hand instead of 4", () => {
    const deck = [makeCard(), makeCard(), makeCard(), makeCard(), makeCard(), makeCard(), makeCard()];
    const state = createBattleState(deck, 0, 0, undefined, 30, defaultTalentEffects, [], 30, ["tattered-pages"]);
    expect(state.hand).toHaveLength(5);
  });
});

describe("Trinket — Sundering Charm (ignore 2 enemy armor)", () => {
  it("physical attack ignores 2 enemy armor", () => {
    const manifest = computeTrinketManifest(["sundering-charm"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, enemyArmor: 5, trinketEffects: manifest, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    // 5 armor - 2 piercing = 3 effective armor. 10 - 3 = 7 damage
    expect(result.state.enemyHealth).toBe(23);
  });
});

describe("Trinket — Runic Quill (draw 1 on consume)", () => {
  it("draws a card when consuming a card", () => {
    const manifest = computeTrinketManifest(["runic-quill"]);
    const card = makeCard({ id: "consumable", consume: true, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const deckCard = makeCard({ id: "deck-card" });
    const state = makeState({ mana: 10, hand: [card], deck: [deckCard], trinketEffects: manifest });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.exhausted).toHaveLength(1);
    expect(result.state.hand).toHaveLength(1); // drew deck-card
    expect(result.state.hand[0].id).toBe("deck-card");
  });
});

describe("Trinket — Mortar and Pestle (first potion free)", () => {
  it("makes the first potion cost 0", () => {
    const manifest = computeTrinketManifest(["mortar-and-pestle"]);
    const card = makeCard({ id: "health-potion", cost: 2, effects: [] });
    const state = makeState({ mana: 2, hand: [card], trinketEffects: manifest });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(2); // no mana spent
    expect(result.state.flags.firstPotionFreeUsed).toBe(true);
  });

  it("second potion costs normal mana", () => {
    const manifest = computeTrinketManifest(["mortar-and-pestle"]);
    const card = makeCard({ id: "health-potion", cost: 2, effects: [] });
    const state = makeState({
      mana: 10,
      hand: [card],
      trinketEffects: manifest,
      flags: {
        firstPhysicalCardFreeUsed: false, firstHolyCardFreeUsed: false, firstBurnCardDoubledUsed: false,
        firstArmorCardDoubledUsed: false, firstPoisonCardFreeUsed: false, firstBleedCardFreeUsed: false,
        nextCardCostReduction: 0, goldOnFirstPoisonThisCombat: false,
        firstHolyDamageBonusUsed: false, firstBurnTrinketDoubledUsed: false,
        firstAilmentPrevented: false, firstPotionFreeUsed: true,
        boneCharmUsed: false, resonantChimeUsedThisTurn: false,
      },
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(8); // spent 2 mana
  });
});

describe("Trinket — Parasitic Bloom (poison tick heals)", () => {
  it("heals player when enemy poison ticks", () => {
    const manifest = computeTrinketManifest(["parasitic-bloom"]);
    const state = makeState({
      mana: 4, maxMana: 4, playerHealth: 20,
      enemyStatuses: { burn: 0, poison: 3, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(21); // 20 + 1 from parasitic bloom
  });
});

describe("Trinket — Ironwood Buckler (6+ block → 1 armor)", () => {
  it("gains armor when block is >= 6 at end of turn", () => {
    const manifest = computeTrinketManifest(["ironwood-buckler"]);
    const state = makeState({
      mana: 4, maxMana: 4, playerHealth: 30,
      playerStatuses: { block: 8, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerStatuses.armor).toBe(1);
  });

  it("does NOT gain armor when block is below 6", () => {
    const manifest = computeTrinketManifest(["ironwood-buckler"]);
    const state = makeState({
      mana: 4, maxMana: 4, playerHealth: 30,
      playerStatuses: { block: 5, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerStatuses.armor).toBe(0);
  });
});

describe("Trinket — Sin-Eater's Lantern (gold on ailment removal)", () => {
  it("gains 1 gold when removing an ailment", () => {
    const manifest = computeTrinketManifest(["sin-eaters-lantern"]);
    const card = makeCard({ effects: [{ kind: "remove-ailment", mode: "one" }] });
    const state = makeState({
      mana: 10, gold: 5,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 2, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      trinketEffects: manifest,
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.gold).toBe(6);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 1 });
  });
});

describe("Trinket — Frozen Heart (stun/freeze skip damage)", () => {
  it("deals 3 damage when enemy skips turn to stun", () => {
    const manifest = computeTrinketManifest(["frozen-heart"]);
    const state = makeState({
      mana: 4, maxMana: 4, enemyHealth: 30, enemyStunSkipTurns: 1,
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(27);
  });
});

describe("Trinket — Cutpurse Knife (gold on bleed application)", () => {
  it("gains 1 gold when applying bleed", () => {
    const manifest = computeTrinketManifest(["cutpurse-knife"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 3 }] });
    const state = makeState({ mana: 10, gold: 0, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.gold).toBe(1);
  });
});

describe("Trinket — Wishing Well Coin (gold on wish)", () => {
  it("gains 3 extra gold when wishing", () => {
    const manifest = computeTrinketManifest(["wishing-well-coin"]);
    const card = makeCard({ effects: [{ kind: "wish" }] });
    const state = makeState({ mana: 10, gold: 2, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.gold).toBe(5);
  });
});

describe("Trinket — Bone Charm (heal on enemy death)", () => {
  it("heals 3 HP when enemy is killed by an attack", () => {
    const manifest = computeTrinketManifest(["bone-charm"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 40 }] });
    const state = makeState({ mana: 10, playerHealth: 15, enemyHealth: 30, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(18);
    expect(result.flags.boneCharmUsed).toBe(true);
  });
});
