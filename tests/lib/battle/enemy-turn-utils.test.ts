import { describe, expect, it, vi } from "vitest";
import {
  advanceToPlayerTurn,
  resetEnemyTurnState,
  resolveDeathsDoorGraceExpiry,
} from "@/lib/battle/player-turn-transition";
import { checkHealthThresholds } from "@/lib/battle/status-player";
import type { CombatTextEvent } from "@/lib/battle/types";
import { getEnemyTraitSet, hasEnemyTrait } from "@/lib/battle/encounter-trait-state";
import { CARDS_PER_TURN } from "@/lib/game-constants";
import { makeTestCardWithId, patchBattleState } from "../../fixtures/battle";

function enemyTurn() {
  return patchBattleState({
    turnPhase: "enemy",
    hand: [],
    deck: Array.from({ length: CARDS_PER_TURN + 1 }, (_, index) => makeTestCardWithId(`d${index}`)),
    rng: () => 0.99,
  });
}

describe("turn boundaries", () => {
  it("draws in order, restores Mana, and resets only turn-scoped flags while each side's Block decays in its own phase", () => {
    const state = { ...enemyTurn(), mana: 0, maxMana: 4 };
    state.playerStatuses.block = 9;
    state.enemyMitigation.block = 9;
    state.flags.wildfireUsed = true;
    state.flags.nextHitCrit = true;
    const result = advanceToPlayerTurn(state);
    expect(result.hand.map((card) => card.id)).toEqual(["d4", "d3", "d2", "d1"]);
    expect(result.deck.map((card) => card.id)).toEqual(["d0"]);
    expect(result.mana).toBe(4);
    expect(result.turnPhase).toBe("player");
    expect(result.turn).toBe(state.turn + 1);
    expect(result.playerStatuses.block).toBe(5);
    expect(result.enemyMitigation.block).toBe(9);
    expect(result.flags.wildfireUsed).toBe(false);
    expect(result.flags.nextHitCrit).toBe(true);
    expect(resetEnemyTurnState(result).enemyMitigation.block).toBe(5);
    expect(state.hand).toEqual([]);
    expect(state.deck).toHaveLength(5);
    expect(state.playerStatuses.block).toBe(9);
    expect(state.flags.wildfireUsed).toBe(true);
  });

  it("uses Mana captured at turn end for Wellspring, rather than Mana earned during the enemy phase", () => {
    const state = enemyTurn();
    state.maxMana = 4;
    state.mana = 2;
    state.talentEffects.wellspringKeepMana = 1;
    expect(advanceToPlayerTurn(state, [], { manaAtTurnEnd: 0 }).mana).toBe(4);
    expect(advanceToPlayerTurn(state, [], { manaAtTurnEnd: 2 }).mana).toBe(5);
  });

  it("still draws while controlled, but clears crowd control for the Death's Door recovery turn", () => {
    const state = enemyTurn();
    state.playerCC = { ...state.playerCC, stunSkipTurns: 2, freezeSkipTurns: 1 };
    const controlled = advanceToPlayerTurn(state);
    expect(controlled.hand).toHaveLength(CARDS_PER_TURN);
    expect(controlled.playerCC).toMatchObject({ stunSkipTurns: 2, freezeSkipTurns: 1 });
    const recovery = advanceToPlayerTurn({
      ...state,
      playerHealth: 0,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: state.turn,
      deathsDoorGraceTurnsRemaining: 1,
    });
    expect(recovery.hand).toHaveLength(CARDS_PER_TURN);
    expect(recovery.playerCC).toMatchObject({ stunSkipTurns: 0, freezeSkipTurns: 0 });
    expect(recovery.deathsDoorGraceTurnsRemaining).toBe(0);
  });

  it.each([
    [10, 14],
    [29, 30],
  ])("caps healing from %i Health while reporting the full potency", (health, expected) => {
    const state = enemyTurn();
    state.playerHealth = health;
    state.gearEffects.healthPerTurn = 4;
    const texts: CombatTextEvent[] = [];
    expect(advanceToPlayerTurn(state, texts).playerHealth).toBe(expected);
    expect(texts).toEqual([{ target: "player", kind: "heal", stat: "health", amount: 4 }]);
  });

  it("never draws or restarts a turn after either combatant is defeated", () => {
    const rng = vi.fn(() => 0.99);
    const state = { ...enemyTurn(), rng };
    const defeat = { ...state, playerHealth: 0 };
    const victory = { ...state, enemyHealth: 0 };
    expect(advanceToPlayerTurn(defeat)).toBe(defeat);
    expect(advanceToPlayerTurn(victory)).toBe(victory);
    expect(rng).not.toHaveBeenCalled();
  });

  it("clears expired Death's Door state without changing recovered Health", () => {
    const state = patchBattleState({
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      playerHealth: 1,
      turn: 2,
    });
    expect(resolveDeathsDoorGraceExpiry(state)).toMatchObject({
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
      playerHealth: 1,
    });
    const ordinary = patchBattleState();
    expect(resolveDeathsDoorGraceExpiry(ordinary)).toBe(ordinary);
  });
});

describe("Health threshold rewards", () => {
  it("pays Block and modified Armor at their own crossings, without paying again below the thresholds", () => {
    const state = patchBattleState({
      playerMaxHealth: 100,
      talentEffects: {
        healthThresholdBlock: { threshold: 50, amount: 4 },
        healthThresholdArmor: [
          { threshold: 50, amount: 5 },
          { threshold: 25, amount: 3 },
        ],
      },
      gearEffects: { flatArmorGained: 1 },
    });
    const texts: CombatTextEvent[] = [];
    const mid = checkHealthThresholds(80, 40, state, texts);
    expect(mid.playerStatuses).toMatchObject({ block: 4, armor: 6 });
    const low = checkHealthThresholds(40, 20, mid, texts);
    expect(low.playerStatuses).toMatchObject({ block: 4, armor: 10 });
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 4 });
    expect(checkHealthThresholds(20, 19, low, texts)).toBe(low);
    expect(state.playerStatuses).toMatchObject({ block: 0, armor: 0 });
  });
});

describe("enemy trait queries", () => {
  it("shares cached traits across turns and refreshes after replacing the trait list", () => {
    const state = patchBattleState({
      currentEnemy: { traits: [{ id: "vampire", title: "Vampire", description: "" }] },
    });
    const traits = getEnemyTraitSet(state);
    expect(hasEnemyTrait(state, "vampire")).toBe(true);
    expect(hasEnemyTrait(state, "vampire", traits)).toBe(true);
    expect(hasEnemyTrait(state, "cleric", traits)).toBe(false);
    const nextTurn = { ...state, turn: state.turn + 1 };
    expect(getEnemyTraitSet(nextTurn)).toBe(traits);
    const replaced = { ...state, currentEnemy: { ...state.currentEnemy, traits: [] } };
    expect(hasEnemyTrait(replaced, "vampire")).toBe(false);
    expect(hasEnemyTrait(state, "vampire")).toBe(true);
  });
});
