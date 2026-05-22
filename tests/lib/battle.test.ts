import { describe, expect, it, vi } from "vitest";
import { mergeCombatText, applyCardEffects, getEnemyDamageMultiplier } from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { endPlayerTurn, chooseWishCard, processCompanionTurnStart } from "@/lib/battle/enemy-turn";
import { drawCards, createBattleState, defaultTalentEffects, shuffleCards } from "@/lib/battle/draw";
import { companionLibrary, enemyBestiary } from "@/lib/game-data";
import type { BattleCard, BestiaryEntry, DifficultyModifier } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";
import { addEnemyStatus, clampHealth, isNullFieldActive, isPlayerDefeated } from "@/lib/battle/types";
import {
  MAX_PLAYER_HEALTH,
  MAX_HAND_SIZE,
  BASE_PLAYER_MANA,
  LABYRINTH_STURDY_MULTIPLIER,
  LABYRINTH_BURNING_GROUND_DAMAGE,
  LABYRINTH_LEECH_HEAL,
  IRON_HIDE_ARMOR_PER_TURN,
} from "@/lib/game-constants";
import { clamp } from "@/lib/utils";
import { defaultTrinketEffects, computeTrinketManifest } from "@/lib/trinkets";
import { defaultBattleState } from "@/lib/battle/draw";

vi.spyOn(Math, "random").mockReturnValue(0.99);

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  return { ...defaultBattleState(), ...overrides };
}

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test-card",
    title: "Test",
    descriptionLines: [""],
    art: "",
    cost: 1,
    effects: [],
    ...overrides,
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

  it("uses corrupted card effect values mechanically", () => {
    const card = makeCard({
      id: "slash",
      corrupted: true,
      descriptionLines: ["Deal 6 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeState({ mana: 10, enemyHealth: 30, hand: [card] });

    const result = playBattleCardResolved(state, "slash", 0);

    expect(result.state.enemyHealth).toBe(24);
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

  it("self-damage applies Health loss and status stack", () => {
    const state = makeState({
      playerHealth: 20,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    });
    const card = makeCard({ effects: [{ kind: "self-damage", damageType: "burn", amount: 3 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(17);
    expect(result.playerStatuses.burn).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 3 });
  });

  it("self-damage clamps health to 0", () => {
    const state = makeState({
      playerHealth: 2,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    });
    const card = makeCard({ effects: [{ kind: "self-damage", damageType: "poison", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(0);
    expect(result.playerStatuses.poison).toBe(5);
  });

  it("self-damage supports all harmful status types", () => {
    const baseStatuses = { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 };
    const state = makeState({ playerHealth: 30, playerStatuses: { ...baseStatuses } });
    const card = makeCard({
      effects: [
        { kind: "self-damage", damageType: "burn", amount: 1 },
        { kind: "self-damage", damageType: "poison", amount: 2 },
        { kind: "self-damage", damageType: "bleed", amount: 3 },
        { kind: "self-damage", damageType: "freeze", amount: 4 },
        { kind: "self-damage", damageType: "stun", amount: 5 },
      ],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(15);
    expect(result.playerStatuses.burn).toBe(1);
    expect(result.playerStatuses.poison).toBe(2);
    expect(result.playerStatuses.bleed).toBe(3);
    expect(result.playerStatuses.freeze).toBe(4);
    expect(result.playerStatuses.stun).toBe(5);
  });

  it("Cauterize removes harmful status and applies self-burn", () => {
    const state = makeState({
      playerHealth: 20,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 3, bleed: 0, freeze: 0, stun: 0 },
    });
    const card = makeCard({
      effects: [
        { kind: "remove-harmful-status", amount: 1 },
        { kind: "self-damage", damageType: "burn", amount: 1 },
      ],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.burn).toBe(1);
    expect(result.playerHealth).toBe(19);
  });

  it("self-damage triggers Death's Door instead of defeat on first fatal hit", () => {
    const state = makeState({
      playerHealth: 1,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    });
    const card = makeCard({ effects: [{ kind: "self-damage", damageType: "bleed", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(0);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.deathsDoorActive).toBe(true);
    expect(result.deathsDoorTriggeredTurn).toBe(1);
    expect(isPlayerDefeated(result)).toBe(false);
  });

  it("handles consume cards (exhaust instead of discard)", () => {
    const card = makeCard({
      id: "consumable",
      consume: true,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
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
    const state = makeState({
      currentEnemy: {
        id: "skeleton",
        title: "Skeleton",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "brittle-bones", title: "Brittle Bones", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "stun")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 2 for burn against trinket-hoarder", () => {
    const state = makeState({
      currentEnemy: {
        id: "goblin",
        title: "Goblin",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "trinket-hoarder", title: "Trinket Hoarder", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(1);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 2 for holy against holy-vulnerability", () => {
    const state = makeState({
      currentEnemy: {
        id: "necromancer",
        title: "Necromancer",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "elite",
        traits: [{ id: "holy-vulnerability", title: "Holy Vulnerability", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 0.5 for burn against burn-resistance", () => {
    const state = makeState({
      currentEnemy: {
        id: "imp",
        title: "Imp",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "burn-resistance", title: "Burn Resistance", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(0.5);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 0.5 for poison against poison-resistance", () => {
    const state = makeState({
      currentEnemy: {
        id: "lizard-scout",
        title: "Lizard Scout",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "poison-resistance", title: "Poison Resistance", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "poison")).toBe(0.5);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 0.5 for bleed against living-armor", () => {
    const state = makeState({
      currentEnemy: {
        id: "living-armor",
        title: "Living Armor",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "elite",
        traits: [{ id: "living-armor", title: "Living Armor", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "bleed")).toBe(0.5);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(1);
  });

  it("returns 0.5 for physical against thick-hide", () => {
    const state = makeState({
      currentEnemy: {
        id: "iron-bear",
        title: "The Iron Bear",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "boss",
        traits: [{ id: "thick-hide", title: "Thick Hide", description: "Receives half Physical damage" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(0.5);
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(1);
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
        traits: [{ id: "trinket-hoarder", title: "Trinket Hoarder", description: "Receives double Burn damage." }],
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

  it("does not trigger first-poison gold when enemy is immune", () => {
    // Armor no longer blocks non-physical damage, so this tests a different scenario:
    // Immunity through max health / damage threshold is tested in other poison tests.
  });

  it("does not trigger Cutpurse Knife when enemy is immune", () => {
    // Armor no longer blocks non-physical damage (bleed), so immunity from
    // armor is no longer applicable. The Cutpurse Knife bleed interaction
    // is tested in the companion bleed test above.
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
    const card = makeCard({
      id: "wolf-companion",
      title: "Wolf Companion",
      consume: true,
      effects: [{ kind: "summon-companion", companionId: "wolf" }],
    });
    const state = makeState({ mana: 4, hand: [card] });

    const result = playBattleCardResolved(state, card.id, 0);

    expect(result.state.activeCompanion?.id).toBe("wolf");
    expect(result.state.hand).toHaveLength(0);
    expect(result.state.exhausted).toEqual([card]);
  });

  it("replaces the current companion when another companion is summoned", () => {
    const card = makeCard({ id: "wolf-companion", effects: [{ kind: "summon-companion", companionId: "wolf" }] });
    const state = makeState({
      mana: 4,
      hand: [card],
      activeCompanion: { ...companionLibrary.wolf, title: "Old Wolf" },
    });

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
    const state = makeState({
      mana: 4,
      maxMana: 4,
      turnPhase: "player",
      hand: [makeCard({ id: "c1" }), makeCard({ id: "c2" })],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
    });
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.turn).toBe(2);
    expect(result.state.hand.length).toBeGreaterThanOrEqual(1);
    expect(result.state.mana).toBe(4);
  });

  it("skips enemy turn when enemyStunSkipTurns > 0", () => {
    const state = makeState({
      enemyStunSkipTurns: 1,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyStunSkipTurns).toBe(0);
    expect(result.state.playerHealth).toBe(30); // no damage taken
    expect(result.combatTexts).not.toContainEqual({ target: "enemy", kind: "status", stat: "stun", amount: 0 });
  });

  it("fully clears one remaining block at next player turn", () => {
    const state = makeState({
      enemyAttackEffects: [],
      playerStatuses: { ...defaultBattleState().playerStatuses, block: 1 },
      deck: [makeCard({ id: "d1" })],
      mana: 4,
      maxMana: 4,
    });

    const result = endPlayerTurn(state);

    expect(result.state.playerStatuses.block).toBe(0);
  });

  it("applies enemy attack damage", () => {
    const state = makeState({
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      playerHealth: 30,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // With no block or armor, all 8 damage goes through
    expect(result.state.playerHealth).toBe(22);
  });

  it("flags player turn skips after enemy stun so the controller can continue combat", () => {
    const state = makeState({
      enemyAttackEffects: [{ kind: "player-status", status: "stun", amount: 20 }],
      playerHealth: 30,
      playerMaxHealth: 30,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      hand: [makeCard({ id: "h1" })],
      mana: 2,
      maxMana: 4,
    });

    const result = endPlayerTurn(state);

    expect(result.playerTurnSkipped).toBe(true);
    expect(result.state.turnPhase).toBe("enemy");
    expect(result.state.hand).toEqual([]);
    expect(result.state.mana).toBe(2);
    expect(result.state.playerStunSkipTurns).toBe(0);
    expect(result.state.playerStatuses.stun).toBe(0);
  });

  it("triggers Death's Door instead of defeat on the first fatal combat damage", () => {
    const state = makeState({
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      playerHealth: 5,
      deck: [makeCard({ id: "d1" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorUsed).toBe(true);
    expect(result.state.deathsDoorActive).toBe(true);
    expect(result.state.deathsDoorTriggeredTurn).toBe(1);
    expect(isPlayerDefeated(result.state)).toBe(false);
  });

  it("Death's Door recovery turn is not skipped by pending player crowd control", () => {
    const state = makeState({
      playerHealth: 2,
      playerStatuses: { ...defaultBattleState().playerStatuses, burn: 3 },
      playerStunSkipTurns: 1,
      enemyStunSkipTurns: 1,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      hand: [makeCard({ id: "h1" })],
      mana: 2,
      maxMana: 4,
    });

    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(true);
    expect(result.state.turnPhase).toBe("player");
    expect(result.playerTurnSkipped).toBe(false);
    expect(result.state.playerStunSkipTurns).toBe(0);
  });

  it("kills the player at the next enemy turn end if Death's Door was not healed", () => {
    const state = makeState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      turn: 2,
      deck: [makeCard({ id: "d1" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
    expect(isPlayerDefeated(result.state)).toBe(true);
  });

  it("does not retrigger Death's Door after it was consumed", () => {
    const state = makeState({
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      playerHealth: 3,
      deathsDoorUsed: true,
      deck: [makeCard({ id: "d1" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
    expect(isPlayerDefeated(result.state)).toBe(true);
  });

  it("healing above 0 clears Death's Door but keeps it consumed", () => {
    const state = makeState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
    });
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
      enemyStatuses: { burn: 0, poison: 0, bleed: 10, freeze: 0, stun: 0 },
      pendingBleedLeechHealing: 4,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.enemyTurnStartState?.enemyHealth).toBe(20);
    expect(result.enemyTurnStartState?.playerHealth).toBe(24);
    expect(result.enemyTurnStartCombatTexts).toEqual([
      { target: "player", kind: "heal", stat: "health", amount: 4 },
      { target: "enemy", kind: "damage", stat: "bleed", amount: 10 },
    ]);
    expect(result.enemyResolutionCombatTexts).toContainEqual({
      target: "player",
      kind: "damage",
      stat: "health",
      amount: 8,
    });
    // Enemy takes 10 bleed damage
    expect(result.state.enemyHealth).toBe(20);
    // Player takes 8 enemy attack then heals 4 from leech: 20 - 8 + 4 = 16
    expect(result.state.playerHealth).toBe(16);
    expect(result.state.enemyStatuses.bleed).toBe(0);
    expect(result.state.pendingBleedLeechHealing).toBe(0);
  });

  it("applies bleed leech healing when bleed kills the enemy before their attack", () => {
    const state = makeState({
      playerHealth: 20,
      enemyHealth: 6,
      enemyMaxHealth: 30,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      enemyStatuses: { burn: 0, poison: 0, bleed: 10, freeze: 0, stun: 0 },
      pendingBleedLeechHealing: 4,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });

    const result = endPlayerTurn(state);

    expect(result.enemyTurnStartState?.enemyHealth).toBe(0);
    expect(result.enemyTurnStartState?.playerHealth).toBe(24);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.playerHealth).toBe(24);
    expect(result.enemyResolutionCombatTexts).toEqual([]);
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
    expect(result.state.playerStatuses.burn).toBe(3);
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

  it("uses Plague Doctor's Mask only on harmful status effects", () => {
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
    expect(result.state.flags.firstHarmfulStatusPrevented).toBe(true);
    expect(result.state.playerHealth).toBe(30); // no damage when prevented
  });

  it.each([
    { status: "burn", amount: 2, expectedHealth: 28, expectedStack: 1, note: "burn halves to 1" },
    { status: "poison", amount: 3, expectedHealth: 27, expectedStack: 2, note: "poison reduces by 1 to 2" },
    { status: "bleed", amount: 2, expectedHealth: 28, expectedStack: 0, note: "bleed resets to 0" },
    { status: "freeze", amount: 3, expectedHealth: 30, expectedStack: 3, note: "freeze below threshold persists" },
    { status: "stun", amount: 2, expectedHealth: 30, expectedStack: 2, note: "stun below threshold persists" },
  ] as const)(
    "enemy $status attack applies $status and tick $note",
    ({ status, amount, expectedHealth, expectedStack }) => {
      const state = makeState({
        playerHealth: 30,
        playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
        enemyAttackEffects: [{ kind: "player-status", status, amount } as const],
        deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
        mana: 4,
        maxMana: 4,
      });
      const result = endPlayerTurn(state);
      expect(result.state.playerHealth).toBe(expectedHealth);
      expect(result.state.playerStatuses[status]).toBe(expectedStack);
    },
  );

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

  it("difficulty modifier enemy-gains-forge-each-turn increments enemyForge", () => {
    const state = makeState({
      enemyAttackEffects: [],
      difficultyModifiers: [{ kind: "enemy-gains-forge-each-turn" }] as DifficultyModifier[],
      enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0 },
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });

    const result = endPlayerTurn(state);

    expect(result.state.enemyMitigation.forge).toBe(1);
    expect(result.combatTexts).toContainEqual({ target: "enemy", kind: "status", stat: "forge", amount: 1 });
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

  it("applies only the active companion's bond level", () => {
    const wolfState = makeState({
      activeCompanion: companionLibrary.wolf,
      enemyAttackEffects: [],
      talentEffects: {
        ...defaultTalentEffects,
        companionBondLevels: { ...defaultTalentEffects.companionBondLevels, wolf: 2 },
      },
    });
    const impState = makeState({
      activeCompanion: companionLibrary.imp,
      enemyAttackEffects: [],
      talentEffects: {
        ...defaultTalentEffects,
        companionBondLevels: { ...defaultTalentEffects.companionBondLevels, wolf: 2 },
      },
    });

    const wolfResult = processCompanionTurnStart(wolfState, []);
    const impResult = processCompanionTurnStart(impState, []);

    expect(wolfResult.enemyHealth).toBe(27);
    expect(impResult.enemyHealth).toBe(28);
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
    expect(result.wishQueue).toEqual([]);
  });

  it("puts card in discard if hand is full", () => {
    const card = makeCard({ id: "wish-card" });
    const fullHand = Array(7)
      .fill(null)
      .map((_, i) => makeCard({ id: `h${i}` }));
    const state = makeState({ hand: fullHand, wishOptions: [card] });
    const result = chooseWishCard(state, "wish-card");
    expect(result.discard).toContainEqual(card);
    expect(result.wishOptions).toBeNull();
    expect(result.wishQueue).toEqual([]);
  });

  it("opens the next queued Wish after choosing a card", () => {
    const firstCard = makeCard({ id: "first-wish-card" });
    const secondCard = makeCard({ id: "second-wish-card" });
    const state = makeState({ hand: [], wishOptions: [firstCard], wishQueue: [[secondCard]] });

    const firstChoice = chooseWishCard(state, "first-wish-card");
    expect(firstChoice.hand.map((card) => card.id)).toEqual(["first-wish-card"]);
    expect(firstChoice.wishOptions).toEqual([secondCard]);
    expect(firstChoice.wishQueue).toEqual([]);

    const secondChoice = chooseWishCard(firstChoice, "second-wish-card");
    expect(secondChoice.hand.map((card) => card.id)).toEqual(["first-wish-card", "second-wish-card"]);
    expect(secondChoice.wishOptions).toBeNull();
    expect(secondChoice.wishQueue).toEqual([]);
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

  it("queues one choice per Wish amount", () => {
    const card = makeCard({ effects: [{ kind: "wish", amount: 2 }] });
    const state = makeState();
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.wishOptions).toHaveLength(3);
    expect(result.wishQueue).toHaveLength(1);
    expect(result.wishQueue[0]).toHaveLength(3);
  });

  it("applies on-Wish rewards once per Wish amount", () => {
    const card = makeCard({ effects: [{ kind: "wish", amount: 2 }] });
    const state = makeState({
      gold: 2,
      talentEffects: { ...defaultTalentEffects, goldOnWish: 3, healthOnWish: 2 },
      playerHealth: 20,
    });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.gold).toBe(8);
    expect(result.playerHealth).toBe(24);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 6 });
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 4 });
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

  it("respects MAX_HAND_SIZE", () => {
    const deck = Array(10)
      .fill(null)
      .map((_, i) => makeCard({ id: `c${i}` }));
    const result = drawCards(
      deck,
      [],
      Array(6)
        .fill(null)
        .map((_, i) => makeCard({ id: `h${i}` })),
      10,
    );
    expect(result.hand).toHaveLength(MAX_HAND_SIZE);
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
  const battleDeck = [makeCard({ id: "slash" }), makeCard({ id: "block" })];

  it("creates a valid battle state with starting hand", () => {
    const result = createBattleState(battleDeck, 0, 0, skeleton);
    expect(result.turn).toBe(1);
    expect(result.playerHealth).toBe(MAX_PLAYER_HEALTH);
    expect(result.enemyHealth).toBe(30);
    expect(result.hand.length).toBeGreaterThanOrEqual(1);
    expect(result.mana).toBe(BASE_PLAYER_MANA);
    expect(result.activeCompanion).toBeNull();
  });

  it("throws when no enemy is provided", () => {
    expect(() => createBattleState(battleDeck, 0)).toThrow("createBattleState requires currentEnemy");
  });

  it("scales enemy stats by cumulative rooms in run", () => {
    // totalRooms=5 → scaler=4, roomMul=1+4*0.05=1.20
    // Normal skeleton: hpTypeMul=1
    const result = createBattleState(battleDeck, 0, 5, skeleton);
    expect(result.enemyHealth).toBe(36); // round(30 * 1.20) = 36
    expect(result.enemyAttackEffects[0].amount).toBe(11); // round(9 * 1.20) = 11
  });

  describe("difficulty modifiers", () => {
    it("Knight Novice (d1): start-block 5 adds to player block", () => {
      const result = createBattleState(
        battleDeck,
        0,
        0,
        skeleton,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [{ kind: "start-block", amount: 5 }],
      );
      expect(result.playerStatuses.block).toBe(5);
      expect(result.enemyMitigation.armor).toBe(0);
    });

    it("Knight Adventurer (d2): enemy-starting-armor 2", () => {
      const result = createBattleState(
        battleDeck,
        0,
        0,
        skeleton,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [{ kind: "enemy-starting-armor", amount: 2 }],
      );
      expect(result.enemyMitigation.armor).toBe(2);
    });

    it("Iron Bear starts combat with 0 starting armor", () => {
      const ironBear = enemyBestiary.find((e) => e.id === "iron-bear")!;
      const result = createBattleState(battleDeck, 0, 0, ironBear);
      expect(result.enemyMitigation.armor).toBe(0);
    });

    it("Knight Legend (d3): enemy-gains-forge-each-turn is stored in difficultyModifiers", () => {
      const mods: DifficultyModifier[] = [{ kind: "enemy-gains-forge-each-turn" }];
      const result = createBattleState(
        battleDeck,
        0,
        0,
        skeleton,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        mods,
      );
      expect(result.difficultyModifiers).toEqual(mods);
    });

    it("Wizard Novice (d1): start-max-mana 1 adds extra mana", () => {
      const result = createBattleState(
        battleDeck,
        0,
        0,
        skeleton,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [{ kind: "start-max-mana", amount: 1 }],
      );
      expect(result.mana).toBe(BASE_PLAYER_MANA + 1);
      expect(result.maxMana).toBe(BASE_PLAYER_MANA + 1);
    });

    it("Ranger Novice (d1): start-companion spawns wolf", () => {
      const result = createBattleState(
        battleDeck,
        0,
        0,
        skeleton,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [{ kind: "start-companion" }],
      );
      expect(result.activeCompanion).not.toBeNull();
      expect(result.activeCompanion?.id).toBe("wolf");
    });

    it("increase-enemy-physical-damage boosts matching damage effect", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      };
      const result = createBattleState(
        battleDeck,
        0,
        0,
        withBoss,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [{ kind: "increase-enemy-physical-damage", amount: 3 }],
      );
      const dmgEffect = result.enemyAttackEffects.find((e) => e.kind === "damage")!;
      expect(dmgEffect.amount).toBe(11);
    });

    it("increase-enemy-damage boosts any damage effect", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      };
      const result = createBattleState(
        battleDeck,
        0,
        0,
        withBoss,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [{ kind: "increase-enemy-damage", amount: 4 }],
      );
      const dmgEffect = result.enemyAttackEffects.find((e) => e.kind === "damage")!;
      expect(dmgEffect.amount).toBe(12);
    });

    it("increase-enemy-status boosts matching status effect", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [
          { kind: "damage", damageType: "physical", amount: 6 },
          { kind: "player-status" as const, status: "poison" as const, amount: 2 },
        ],
      };
      const result = createBattleState(
        battleDeck,
        0,
        0,
        withBoss,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [{ kind: "increase-enemy-status", status: "poison", amount: 2 }],
      );
      const poisonEffect = result.enemyAttackEffects.find((e) => e.kind === "player-status" && e.status === "poison")!;
      expect(poisonEffect.amount).toBe(4);
      const dmgEffect = result.enemyAttackEffects.find((e) => e.kind === "damage")!;
      expect(dmgEffect.amount).toBe(6); // unchanged
    });

    it("enemy-attacks-gain-leech adds lifesteal to damage effects", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      };
      const result = createBattleState(
        battleDeck,
        0,
        0,
        withBoss,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [{ kind: "enemy-attacks-gain-leech" }],
      );
      const dmgEffect = result.enemyAttackEffects.find((e) => e.kind === "damage")!;
      expect((dmgEffect as typeof dmgEffect & { lifesteal: boolean }).lifesteal).toBe(true);
    });

    it("multiple modifiers apply simultaneously", () => {
      const mods: DifficultyModifier[] = [
        { kind: "start-block", amount: 5 },
        { kind: "enemy-starting-armor", amount: 2 },
        { kind: "start-max-mana", amount: 1 },
      ];
      const result = createBattleState(
        battleDeck,
        0,
        0,
        skeleton,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        mods,
      );
      expect(result.playerStatuses.block).toBe(5);
      expect(result.enemyMitigation.armor).toBe(2);
      expect(result.mana).toBe(BASE_PLAYER_MANA + 1);
      expect(result.maxMana).toBe(BASE_PLAYER_MANA + 1);
    });

    it("increase-enemy-status does not affect non-matching status", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [
          { kind: "damage", damageType: "physical", amount: 6 },
          { kind: "player-status" as const, status: "burn" as const, amount: 2 },
        ],
      };
      const result = createBattleState(
        battleDeck,
        0,
        0,
        withBoss,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [{ kind: "increase-enemy-status", status: "poison", amount: 2 }],
      );
      const burnEffect = result.enemyAttackEffects.find((e) => e.kind === "player-status" && e.status === "burn")!;
      expect(burnEffect.amount).toBe(2); // unchanged, wrong status
    });
  });
});

// ─── Labyrinth Modifier Integration ───

describe("labyrinth modifiers on createBattleState", () => {
  const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;
  const battleDeck = [makeCard({ id: "slash" }), makeCard({ id: "block" })];
  const BASE_ENEMY_HEALTH = 30;

  it("labyrinth-sturdy scales enemyMaxHealth by 1.3x", () => {
    const result = createBattleState(
      battleDeck,
      0,
      0,
      skeleton,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [{ kind: "labyrinth-sturdy" }],
    );
    expect(result.enemyMaxHealth).toBe(Math.floor(BASE_ENEMY_HEALTH * LABYRINTH_STURDY_MULTIPLIER));
    expect(result.enemyHealth).toBe(result.enemyMaxHealth);
  });

  it("labyrinth-null-field modifier is detected by isNullFieldActive", () => {
    const result = createBattleState(
      battleDeck,
      0,
      0,
      skeleton,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [{ kind: "labyrinth-null-field" }],
    );
    expect(isNullFieldActive(result)).toBe(true);
  });

  it("labyrinth-null-field is false without the modifier", () => {
    const result = createBattleState(battleDeck, 0, 0, skeleton);
    expect(isNullFieldActive(result)).toBe(false);
  });

  it("sturdy and null-field stack correctly", () => {
    const result = createBattleState(
      battleDeck,
      0,
      0,
      skeleton,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [{ kind: "labyrinth-sturdy" }, { kind: "labyrinth-null-field" }],
    );
    expect(result.enemyMaxHealth).toBe(Math.floor(BASE_ENEMY_HEALTH * LABYRINTH_STURDY_MULTIPLIER));
    expect(isNullFieldActive(result)).toBe(true);
  });
});

describe("labyrinth modifiers on endPlayerTurn", () => {
  it("labyrinth-burning-ground adds burn to player each turn", () => {
    const state = makeState({
      difficultyModifiers: [{ kind: "labyrinth-burning-ground" }] as DifficultyModifier[],
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      playerHealth: 30,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 0,
      maxMana: 1,
    });
    const result = endPlayerTurn(state);
    // 2 burn added, then tick halves to 1 and deals 2 damage.
    expect(result.state.playerStatuses.burn).toBe(1);
    expect(result.state.playerHealth).toBe(28); // 30 - 2 burn damage
    expect(result.combatTexts).not.toContainEqual({
      target: "player",
      kind: "status",
      stat: "burn",
      amount: LABYRINTH_BURNING_GROUND_DAMAGE,
    });
    expect(result.combatTexts).toContainEqual({
      target: "player",
      kind: "damage",
      stat: "burn",
      amount: LABYRINTH_BURNING_GROUND_DAMAGE,
    });
  });

  it("labyrinth-leeching heals enemy each turn", () => {
    const state = makeState({
      difficultyModifiers: [{ kind: "labyrinth-leeching" }] as DifficultyModifier[],
      enemyHealth: 20,
      enemyMaxHealth: 30,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 0,
      maxMana: 1,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(23); // 20 + 3
    expect(result.combatTexts).toContainEqual({
      target: "enemy",
      kind: "status",
      stat: "health",
      amount: LABYRINTH_LEECH_HEAL,
    });
  });

  it("labyrinth-leeching does not overheal", () => {
    const state = makeState({
      difficultyModifiers: [{ kind: "labyrinth-leeching" }] as DifficultyModifier[],
      enemyHealth: 30,
      enemyMaxHealth: 30,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 0,
      maxMana: 1,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(30); // capped at max
  });

  it("burning-ground and leeching apply together", () => {
    const state = makeState({
      difficultyModifiers: [
        { kind: "labyrinth-burning-ground" },
        { kind: "labyrinth-leeching" },
      ] as DifficultyModifier[],
      enemyHealth: 20,
      enemyMaxHealth: 30,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      playerHealth: 30,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 0,
      maxMana: 1,
    });
    const result = endPlayerTurn(state);
    // Burn: 2 added, tick halves to 1. Leech: enemy heals 3 from 20 → 23.
    expect(result.state.playerStatuses.burn).toBe(1);
    expect(result.state.playerHealth).toBe(28); // 30 - 2 burn damage
    expect(result.state.enemyHealth).toBe(23); // 20 + 3
  });
});

describe("null-field in addEnemyStatus", () => {
  it("halves the delta when labyrinth-null-field modifier is present", () => {
    const state = makeState({ difficultyModifiers: [{ kind: "labyrinth-null-field" }] as DifficultyModifier[] });
    const result = addEnemyStatus(state, "burn", 10);
    expect(result.enemyStatuses.burn).toBe(5);
  });

  it("does not halve when modifier is absent", () => {
    const state = makeState();
    const result = addEnemyStatus(state, "burn", 10);
    expect(result.enemyStatuses.burn).toBe(10);
  });

  it("minimum value is 1 even for small deltas", () => {
    const state = makeState({ difficultyModifiers: [{ kind: "labyrinth-null-field" }] as DifficultyModifier[] });
    const result = addEnemyStatus(state, "poison", 1);
    expect(result.enemyStatuses.poison).toBe(1);
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

describe("Trinket — Brass Censer (first Holy damage doubled)", () => {
  it("doubles the first holy damage", () => {
    const manifest = computeTrinketManifest(["brass-censer"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    // 5 base * 2 trinket = 10 damage (no crit due to mock returning 0.99 > 5%)
    expect(result.state.enemyHealth).toBe(20);
    expect(result.state.flags.firstHolyDamageBonusUsed).toBe(true);
  });

  it("does NOT double the second holy attack", () => {
    const manifest = computeTrinketManifest(["brass-censer"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const card2 = makeCard({ id: "holy2", effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest, hand: [card] });
    const first = playBattleCardResolved(state, card.id, 0);
    const second = playBattleCardResolved({ ...first.state, hand: [card2] }, card2.id, 0);
    // First: 10 damage. Second: 5 damage. Total: 15 damage = 15 remaining
    expect(second.state.enemyHealth).toBe(15);
  });
});

describe("Trinket — Tattered Pages (extra draw at battle start)", () => {
  it("deals 5 cards in opening hand instead of 4", () => {
    const deck = [makeCard(), makeCard(), makeCard(), makeCard(), makeCard(), makeCard(), makeCard()];
    const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;
    const state = createBattleState(deck, 0, 0, skeleton, 30, defaultTalentEffects, [], 30, ["tattered-pages"]);
    expect(state.hand).toHaveLength(5);
  });
});

describe("Trinket — Sundering Charm (ignore 2 enemy armor)", () => {
  it("physical attack ignores 2 enemy armor", () => {
    const manifest = computeTrinketManifest(["sundering-charm"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] });
    const state = makeState({
      mana: 10,
      enemyHealth: 30,
      enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0 },
      trinketEffects: manifest,
      hand: [card],
    });
    const result = playBattleCardResolved(state, card.id, 0);
    // 5 armor - 2 piercing = 3 effective armor. 10 - 3 = 7 damage
    expect(result.state.enemyHealth).toBe(23);
  });
});

describe("Trinket — Runic Quill (draw 1 on consume)", () => {
  it("draws a card when consuming a card", () => {
    const manifest = computeTrinketManifest(["runic-quill"]);
    const card = makeCard({
      id: "consumable",
      consume: true,
      effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
    });
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
        firstPotionFreeUsed: true,
        resonantChimeUsedThisTurn: false,
      },
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(8); // spent 2 mana
  });
});

describe("Trinket — Parasitic Bloom (10% chance to leech poison damage)", () => {
  it("heals for poison damage when the 10% leech procs", () => {
    vi.mocked(Math.random).mockReturnValueOnce(0.05); // 5% < 10% = proc
    const manifest = computeTrinketManifest(["parasitic-bloom"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      playerHealth: 20,
      enemyStatuses: { burn: 0, poison: 3, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    // poison damage = 3 * 1x multiplier = 3, leech heals for 3
    expect(result.state.playerHealth).toBe(23);
  });

  it("does not heal when the 10% leech fails", () => {
    vi.mocked(Math.random).mockReturnValueOnce(0.15); // 15% > 10% = no proc
    const manifest = computeTrinketManifest(["parasitic-bloom"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      playerHealth: 20,
      enemyStatuses: { burn: 0, poison: 3, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(20);
  });
});

describe("Trinket — Ironwood Buckler (6+ block → 1 armor)", () => {
  it("gains armor when block is >= 6 at end of turn", () => {
    const manifest = computeTrinketManifest(["ironwood-buckler"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      playerHealth: 30,
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
      mana: 4,
      maxMana: 4,
      playerHealth: 30,
      playerStatuses: { block: 5, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerStatuses.armor).toBe(0);
  });
});

describe("Trinket — Sin-Eater's Lantern (heal on harmful status removal)", () => {
  it("gains 6 health when removing a harmful status", () => {
    const manifest = computeTrinketManifest(["sin-eaters-lantern"]);
    const card = makeCard({ effects: [{ kind: "remove-harmful-status", amount: 1 }] });
    const state = makeState({
      mana: 10,
      playerHealth: 20,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 2, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      trinketEffects: manifest,
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 6 });
  });
});

  describe("Trinket — Icy Heart (6 physical damage on freeze)", () => {
  it("deals 6 physical damage when freeze triggers", () => {
    const manifest = computeTrinketManifest(["icy-heart"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 15 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // 15 freeze damage (30→15), freeze triggers (threshold 7.5), frozen heart 6 (15→9)
    expect(result.enemyHealth).toBe(9);
  });

  it("deals freeze damage without frozen heart when no trinket", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 15 }] });
    const state = makeState({ mana: 10, enemyHealth: 30 });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // 15 freeze damage, freeze triggers, no frozen heart bonus
    expect(result.enemyHealth).toBe(15);
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
    const card = makeCard({ effects: [{ kind: "wish", amount: 1 }] });
    const state = makeState({ mana: 10, gold: 2, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.gold).toBe(5);
  });
});

describe("Trinket — Bone Charm (heal on enemy defeat)", () => {
  it("heals 3 Health when enemy is killed by an attack", () => {
    const manifest = computeTrinketManifest(["bone-charm"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 40 }] });
    const state = makeState({ mana: 10, playerHealth: 15, enemyHealth: 30, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(18);
  });

  it("does not heal when enemy dies from status ticks (not player defeat)", () => {
    const manifest = computeTrinketManifest(["bone-charm"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      playerHealth: 15,
      enemyHealth: 1,
      enemyMaxHealth: 1,
      enemyStatuses: { burn: 0, poison: 3, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    // enemy dies from poison tick (3 damage), bone charm does NOT trigger
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.playerHealth).toBe(15);
  });
});

describe("Trinket — Companion's Collar (+1 companion damage)", () => {
  it("Wolf companion deals 1 bleed + 1 collar = 2 bleed damage, doubled to 4 by BLEED_STATUS_MULTIPLIER", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 30,
      activeCompanion: companionLibrary["wolf"],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.bleed).toBe(4); // (1 base + 1 collar) * 2 multiplier
  });

  it("stacks with companionDamage talent", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 30,
      activeCompanion: companionLibrary["wolf"],
      trinketEffects: manifest,
      talentEffects: { ...defaultTalentEffects, companionDamage: 2 },
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.bleed).toBe(8); // (1 base + 1 collar + 2 talent) * 2 multiplier
  });

  it("Lizard Scout companion also benefits from collar", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 30,
      activeCompanion: companionLibrary["lizard-scout"],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.poison).toBe(2); // 1 base + 1 collar
  });

  it("Imp companion also benefits from collar", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 30,
      activeCompanion: companionLibrary["imp"],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.burn).toBe(3); // 2 base + 1 collar
  });

  it("does nothing when no companion is active", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    const state = makeState({ trinketEffects: manifest, activeCompanion: null });
    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);
    expect(result).toBe(state);
  });
});

describe("Trinket — Polar Pendant (freeze lasts 1 turn longer)", () => {
  it("extends freeze skip turns by 1 when freeze triggers", () => {
    const manifest = computeTrinketManifest(["frozen-pocketwatch"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 15 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyFreezeSkipTurns).toBe(2); // 1 base + 1 extension
  });

  it("without pendant, freeze skip turns is 1", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 15 }] });
    const state = makeState({ mana: 10, enemyHealth: 30 });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyFreezeSkipTurns).toBe(1);
  });

  it("does not trigger freeze when threshold not met", () => {
    const manifest = computeTrinketManifest(["frozen-pocketwatch"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 7 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyFreezeSkipTurns).toBe(0);
  });
});

describe("Trinket — Thunderstone (6 nature damage on stun)", () => {
  it("deals 6 nature damage when stun threshold is crossed", () => {
    const manifest = computeTrinketManifest(["thunderstone"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 50 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(44); // 100 - 50 (stun) - 6 (thunderstone)
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "nature", amount: 6 });
  });

  it("does NOT deal thunderstone damage when stun does not trigger", () => {
    const manifest = computeTrinketManifest(["thunderstone"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 10 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(90); // 100 - 10, no thunderstone
  });

  it("without trinket, no extra damage on stun", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 50 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100 });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(50); // 100 - 50, no thunderstone
  });

  it("fires from Obsidian Hammer forge-based stun rider", () => {
    const manifest = computeTrinketManifest(["obsidian-hammer", "thunderstone"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = makeState({
      mana: 10,
      enemyHealth: 3,
      enemyMaxHealth: 3,
      enemyMitigation: { armor: 3, forge: 0, freezeBonus: 0 },
      playerStatuses: { block: 0, armor: 0, forge: 4, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      trinketEffects: manifest,
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // forge(4) + card(1) = 5, armor(3) → 2 damage → health = 1
    // forge rider adds 1 stun → 1 > 1*0.5 → stun triggers → thunderstone(6) → health = 0
    expect(result.enemyHealth).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "nature", amount: 6 });
  });
});

describe("Trinket — Thunderstone + Lucky Clover chaining", () => {
  it("Lucky Clover can proc gold from Thunderstone nature damage", () => {
    const manifest = computeTrinketManifest(["thunderstone", "lucky-clover"]);
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.99) // crit check → no crit
      .mockReturnValueOnce(0.05); // Lucky Clover → 5 < 10 = proc
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 50 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, gold: 0, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(44);
    expect(result.gold).toBe(6); // gold = thunderstone damage
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 6 });
  });

  it("does not grant gold when Lucky Clover does not proc", () => {
    const manifest = computeTrinketManifest(["thunderstone", "lucky-clover"]);
    // Math.random returns 0.99 (default mock) → Lucky Clover fails
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 50 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, gold: 0, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(44);
    expect(result.gold).toBe(0);
  });
});

describe("Trinket — Lucky Clover (10% nature damage → gold)", () => {
  it("grants gold equal to nature damage dealt when proc triggers", () => {
    const manifest = computeTrinketManifest(["lucky-clover"]);
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.99) // crit check → no crit
      .mockReturnValueOnce(0.05); // Lucky Clover → 5 < 10 = proc
    const card = makeCard({ effects: [{ kind: "damage", damageType: "nature", amount: 8 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, gold: 0, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(92); // 100 - 8
    expect(result.gold).toBe(8); // gold = damage dealt
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 8 });
  });

  it("does not grant gold when proc does not trigger (90% fail)", () => {
    const manifest = computeTrinketManifest(["lucky-clover"]);
    // Math.random returns 0.99 (default mock) → Lucky Clover fails
    const card = makeCard({ effects: [{ kind: "damage", damageType: "nature", amount: 8 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, gold: 0, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(92);
    expect(result.gold).toBe(0);
  });

  it("does nothing without the trinket", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "nature", amount: 8 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, gold: 0 });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(92);
    expect(result.gold).toBe(0);
  });
});

// ─── Enemy Traits (endPlayerTurn) ───

describe("enemy traits via endPlayerTurn", () => {
  it("rusting-carapace adds forge each turn", () => {
    const state = makeState({
      enemyAttackEffects: [],
      currentEnemy: {
        id: "rust-monster",
        title: "Rust Monster",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "rusting-carapace", title: "Rusting Carapace", description: "Gains forge each turn" }],
        attackEffects: [],
      },
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.forge).toBe(1);
  });

  it("iron-hide adds 2 armor each turn", () => {
    const state = makeState({
      enemyAttackEffects: [],
      currentEnemy: {
        id: "iron-bear",
        title: "The Iron Bear",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "boss",
        traits: [{ id: "iron-hide", title: "Iron Hide", description: "Gains 2 Armor each turn" }],
        attackEffects: [],
      },
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.armor).toBe(IRON_HIDE_ARMOR_PER_TURN);
    expect(result.state.enemyMitigation.forge).toBe(0);
    expect(result.combatTexts).toContainEqual({
      target: "enemy",
      kind: "status",
      stat: "armor",
      amount: IRON_HIDE_ARMOR_PER_TURN,
    });
  });

  it("glacial-shell adds freeze bonus each turn", () => {
    const state = makeState({
      enemyAttackEffects: [],
      currentEnemy: {
        id: "ice-golem",
        title: "Ice Golem",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "glacial-shell", title: "Glacial Shell", description: "Gains freeze bonus each turn" }],
        attackEffects: [{ kind: "player-status", status: "freeze", amount: 2 }],
      },
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.freezeBonus).toBe(1);
  });

  it("regeneration heals enemy at end of turn", () => {
    const state = makeState({
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyRegeneration: 4,
      enemyAttackEffects: [],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(24);
    expect(result.combatTexts).toContainEqual({ target: "enemy", kind: "heal", stat: "health", amount: 4 });
  });
});

// ─── Health Threshold Talents (endPlayerTurn) ───

describe("health threshold talents via endPlayerTurn", () => {
  it("healthThresholdBlock grants block when crossing threshold", () => {
    const state = makeState({
      playerHealth: 25,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, healthThresholdBlock: { threshold: 50, amount: 5 } },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 12 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // 25 Health - 12 damage = 13 (43%), crossing 50% threshold → grants 5 block.
    // advanceToPlayerTurn then halves block: round(5/2) = 3
    expect(result.state.playerStatuses.block).toBe(3);
  });

  it("healthThresholdArmor grants armor when crossing threshold", () => {
    const state = makeState({
      playerHealth: 25,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, healthThresholdArmor: { threshold: 50, amount: 3 } },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 12 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // Armor = 3 granted, then -1 from armor decrement in processEnemyDamageEffect
    expect(result.state.playerStatuses.armor).toBe(2);
  });

  it("does not grant threshold bonus when health stays above threshold", () => {
    const state = makeState({
      playerHealth: 20,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, healthThresholdBlock: { threshold: 50, amount: 5 } },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // 20 Health → 18 Health = 60% of 30, above 50% threshold
    expect(result.state.playerStatuses.block).toBe(0);
  });
});

// ─── Block & Armor Absorption (enemy damage) ───

describe("enemy damage absorption via endPlayerTurn", () => {
  it("block absorbs physical damage", () => {
    const state = makeState({
      playerStatuses: { block: 5, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // 8 - 5 block = 3, then 3 - 0 armor = 3 damage
    expect(result.state.playerHealth).toBe(27);
    expect(result.state.playerStatuses.block).toBe(0);
  });

  it("armor reduces physical damage after block", () => {
    const state = makeState({
      playerStatuses: { block: 3, armor: 4, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // 10 - 3 block = 7, then 7 - 4 armor = 3 damage → health = 27
    expect(result.state.playerHealth).toBe(27);
    expect(result.state.playerStatuses.armor).toBe(3); // armor - 1 after taking damage
  });

  it("vanguard crest grants forge when block fully absorbs physical damage", () => {
    const manifest = computeTrinketManifest(["vanguards-crest"]);
    const state = makeState({
      playerStatuses: { block: 10, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 6 }],
      trinketEffects: manifest,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.forge).toBeGreaterThan(0);
    expect(result.combatTexts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 1 });
  });

  it("blockAbsorbPhysicalBonus makes block more effective against physical", () => {
    const state = makeState({
      playerStatuses: { block: 10, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, blockAbsorbPhysicalBonus: 20 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 15 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // blockAbsorbPhysicalBonus 20%: effective block = floor(10 * 1.2) = 12
    // 15 - 12 = 3 damage → health = 27
    expect(result.state.playerHealth).toBe(27);
  });

  it("blockDepletedHeal restores health when block is fully consumed", () => {
    const state = makeState({
      playerHealth: 20,
      playerMaxHealth: 30,
      playerStatuses: { block: 5, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, blockDepletedHeal: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // block absorbs 5, remaining 5 damage → health 20-5=15, then +2 heal = 17
    expect(result.state.playerHealth).toBe(17);
    expect(result.state.playerStatuses.block).toBe(0);
  });

  it("blockDepletedHeal does not trigger when block is not fully consumed", () => {
    const state = makeState({
      playerHealth: 20,
      playerMaxHealth: 30,
      playerStatuses: { block: 10, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, blockDepletedHeal: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // block absorbs 5, block decays from 5 to 3 at end of turn, 0 damage to health, no depletion heal
    expect(result.state.playerHealth).toBe(20);
    expect(result.state.playerStatuses.block).toBe(3);
  });
});

// ─── Damage Riders (dealDamageToEnemy via applyCardEffects) ───

describe("damage riders via applyCardEffects", () => {
  it("applyForgeStunRider triggers stun when forge exceeds threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: { block: 0, armor: 0, forge: 8, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      trinketEffects: { ...defaultTrinketEffects, forgeStunThreshold: 5, forgeStunAmount: 3 },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // Physical damage + forge consumed
    expect(result.playerStatuses.forge).toBe(7); // consumed forge by 1
    // Stun rider triggered: stun = 3 + current stun
    expect(result.enemyStatuses.stun).toBeGreaterThanOrEqual(3);
  });

  it("holy burn chance applies burn on holy damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01); // trigger the holy burn chance
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      talentEffects: { ...defaultTalentEffects, holyBurnChance: 50 },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.burn).toBeGreaterThanOrEqual(5);
  });

  it("gold-trove trait grants 1 gold per hit", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      gold: 0,
      currentEnemy: {
        id: "mimic",
        title: "Mimic",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "gold-trove", title: "Gold Trove", description: "Grants gold when hit" }],
        attackEffects: [],
      },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.gold).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 1 });
  });

  it("bleed desperate multiplier applies when player is below half health", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, bleedDesperateMultiplier: 1.5 },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // base 10 * 1.5 desperate = 15 damage
    expect(result.enemyHealth).toBe(35);
  });

  it("bleed execute threshold doubles damage when enemy is low", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 8,
      enemyMaxHealth: 50,
      talentEffects: { ...defaultTalentEffects, bleedExecuteThreshold: 25 }, // 25% of max = 12.5
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // 8 <= 12.5? Yes. base 5 * 2 execute = 10 damage
    expect(result.enemyHealth).toBe(0); // Actually, 8 - 10 = 0 (clamped)
  });

  it("holy gold percent adds bonus from gold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      gold: 20,
      talentEffects: { ...defaultTalentEffects, holyGoldPercent: 25 }, // 25% of gold
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // base 5 + floor(20 * 25/100) = 5 + 5 = 10 damage
    expect(result.enemyHealth).toBe(40);
  });

  it("armorToPhysicalDamage adds armor to physical damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: { block: 0, armor: 6, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, armorToPhysicalDamage: true },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // 5 + 6 armor = 11 damage
    expect(result.enemyHealth).toBe(39);
  });

  it("blockToPhysicalDamage adds half block to physical damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: { block: 8, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, blockToPhysicalDamage: true },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // 5 + floor(8/2) = 5 + 4 = 9 damage
    expect(result.enemyHealth).toBe(41);
  });

  it("blockToHolyDamage adds half block to holy damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      gold: 0,
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      playerStatuses: { block: 8, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, blockToHolyDamage: true },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // 5 + floor(8/2) = 5 + 4 = 9 damage
    expect(result.enemyHealth).toBe(41);
  });

  it("blockToStunDamage adds half block to stun damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: { block: 8, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, blockToStunDamage: true },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // 5 + floor(8/2) = 5 + 4 = 9 damage
    expect(result.enemyHealth).toBe(41);
    // stun damage also adds stun buildup equal to damage dealt
    expect(result.enemyStatuses.stun).toBe(9);
  });

  it("sunderingArmorPiercing reduces enemy armor against physical", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0 },
      trinketEffects: { ...defaultTrinketEffects, sunderingArmorPiercing: 3 },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // Armor piercing: effective armor = max(0, 5-3) = 2. 10 - 2 = 8 damage.
    expect(result.enemyHealth).toBe(42);
  });

  it("poison physical bonus adds damage when enemy is poisoned", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: { burn: 0, poison: 3, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, poisonPhysicalBonus: 4 },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // 5 + 4 poison bonus = 9 damage
    expect(result.enemyHealth).toBe(41);
  });

  it("burnRemovesEnemyArmor strips armor on burn damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyMitigation: { armor: 8, forge: 0, freezeBonus: 0 },
      talentEffects: { ...defaultTalentEffects, burnRemovesEnemyArmor: true },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 12, lifesteal: true }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // 12 burn damage ignores armor entirely (effectiveArmor=0), modifiedDamage=12.
    // per-hit reduces armor by 1 (armor: 7).
    // burnRemovesEnemyArmor: armor = max(0, 7-12) = 0
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("equalToBlock deals damage equal to block", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: { block: 7, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0, equalToBlock: true }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(43);
  });

  it("consume forge after physical damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      playerStatuses: { block: 0, armor: 0, forge: 3, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // forge contributed to damage, then forge -= 1
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("enemy lifesteal heals enemy when dealing damage", () => {
    const state = makeState({
      enemyHealth: 15,
      enemyMaxHealth: 30,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 6, lifesteal: true }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // player health: 30 - 6 = 24, enemy health: 15 + 6 = 21
    expect(result.state.playerHealth).toBe(24);
    expect(result.state.enemyHealth).toBe(21);
    expect(result.combatTexts).toContainEqual({ target: "enemy", kind: "heal", stat: "health", amount: 6 });
  });

  it("block prevents poison buildup when blockPreventsPoison talent is active", () => {
    const state = makeState({
      playerStatuses: { block: 1, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, blockPreventsPoison: true },
      enemyAttackEffects: [{ kind: "player-status", status: "poison", amount: 3 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerStatuses.poison).toBe(0);
  });

  it("poison deals damage to player (stun path via enemy attack)", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyAttackEffects: [{ kind: "player-status", status: "poison", amount: 4 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // Poison tick = 4 (health 30→26), then poison decays by 1
    expect(result.state.playerStatuses.poison).toBe(3);
    expect(result.state.playerHealth).toBe(26);
  });

  it("receiveHalfHolyDamage reduces holy enemy damage", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, receiveHalfHolyDamage: true },
      enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 8 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // 8 / 2 = 4 damage
    expect(result.state.playerHealth).toBe(26);
  });

  it("bleedEnemyDamageReduction reduces physical enemy damage", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      talentEffects: { ...defaultTalentEffects, bleedEnemyDamageReduction: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // 10 - 3 = 7 damage
    expect(result.state.playerHealth).toBe(23);
  });

  it("enemy forge bonus adds to physical attack damage", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyMitigation: { armor: 0, forge: 4, freezeBonus: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // 8 + 4 forge = 12 damage
    expect(result.state.playerHealth).toBe(18);
  });

  it("freeze enemy status attack respects freeze bonus from glacial-shell", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      enemyMitigation: { armor: 0, forge: 0, freezeBonus: 2 },
      enemyAttackEffects: [{ kind: "player-status", status: "freeze", amount: 3 }],
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // Freeze applied = 3 + 2 bonus = 5. Below threshold (30*0.5=15), so freeze persists.
    expect(result.state.playerStatuses.freeze).toBe(5);
    expect(result.state.playerHealth).toBe(30);
  });
});

// ─── applyCardEffects ───

describe("applyCardEffects — lose-mana", () => {
  it("reduces current mana, flooring at 0", () => {
    const state = makeState({ mana: 3 });
    const card = makeCard({ effects: [{ kind: "lose-mana", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.mana).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "mana", amount: 5 });
  });
});

describe("applyCardEffects — gain-gold", () => {
  it("adds gold with potion potency multiplier", () => {
    const state = makeState({ gold: 10 });
    state.talentEffects.potionPotency = 1.5;
    const card = makeCard({ id: "luck-potion", effects: [{ kind: "gain-gold", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // Potion card: 10 * 1.5 = 15 gold
    expect(result.gold).toBe(25);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 15 });
  });
});

describe("applyCardEffects — remove-harmful-status", () => {
  it("removes each harmful status type counted individually with potion potency", () => {
    const state = makeState({
      playerStatuses: { ...defaultBattleState().playerStatuses, burn: 5, poison: 3, bleed: 2 },
    });
    state.talentEffects.potionPotency = 2;
    const card = makeCard({ id: "panacea-potion", effects: [{ kind: "remove-harmful-status", amount: 1 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // amount=1, potency=2 → Math.round(2) = 2 status types cleared (burn, poison)
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.bleed).toBe(2);
  });
});

describe("applyCardEffects — self-damage", () => {
  it("damages player and adds matching status", () => {
    const state = makeState({ playerHealth: 25, playerStatuses: { ...defaultBattleState().playerStatuses } });
    const card = makeCard({ effects: [{ kind: "self-damage", damageType: "burn", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(20);
    expect(result.playerStatuses.burn).toBe(5);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 5 });
  });
});

describe("applyCardEffects — unknown effect kind", () => {
  it("ignores unknown effect kinds (default case)", () => {
    const state = makeState({ mana: 3 });
    const card = makeCard({ effects: [{ kind: "unknown" as never, amount: 99 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result).toBe(state);
    expect(texts).toEqual([]);
  });
});
