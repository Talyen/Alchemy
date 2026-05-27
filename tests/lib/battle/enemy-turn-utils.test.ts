import { describe, expect, it } from "vitest";
import {
  advanceToPlayerTurn,
  checkHealthThresholds,
  isFreezeActiveForAspect,
  resolveDeathsDoorEndOfEnemyTurn,
} from "@/lib/battle/enemy-turn-utils";
import { defaultTalentEffects } from "@/lib/battle";
import { CARDS_PER_TURN } from "@/lib/game-constants";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";

function makeCard(id: string) {
  return { id, title: id, descriptionLines: [""], art: "", cost: 1, effects: [] };
}

describe("advanceToPlayerTurn", () => {
  it("draws CARDS_PER_TURN and sets mana to maxMana", () => {
    const state = createTestBattleState({
      turnPhase: "enemy",
      deck: [makeCard("d1"), makeCard("d2"), makeCard("d3"), makeCard("d4"), makeCard("d5")],
      hand: [],
      discard: [],
      maxMana: 4,
      mana: 0,
      rng: () => 0,
    });
    const result = advanceToPlayerTurn(state);
    expect(result.hand).toHaveLength(CARDS_PER_TURN);
    expect(result.mana).toBe(4);
    expect(result.turnPhase).toBe("player");
  });

  it("halves player block via decayHalvedStatus", () => {
    const state = createTestBattleState({
      turnPhase: "enemy",
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 9 },
      deck: [makeCard("d1")],
      rng: () => 0,
    });
    const result = advanceToPlayerTurn(state);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("adds wellspring bonus when unspent mana", () => {
    const state = createTestBattleState({
      turnPhase: "enemy",
      mana: 2,
      maxMana: 4,
      deck: [makeCard("d1")],
      talentEffects: { ...defaultTalentEffects, wellspringKeepMana: 1 },
      rng: () => 0,
    });
    const result = advanceToPlayerTurn(state);
    expect(result.mana).toBe(5);
  });

  it("CC skip: no draw when stun skip active", () => {
    const state = createTestBattleState({
      turnPhase: "enemy",
      playerStunSkipTurns: 1,
      deck: [makeCard("d1"), makeCard("d2")],
      hand: [],
    });
    const result = advanceToPlayerTurn(state);
    expect(result.turnPhase).toBe("enemy");
    expect(result.hand).toHaveLength(0);
    expect(result.playerStunSkipTurns).toBe(0);
  });

  it("Death's Door recovery suppresses CC skip", () => {
    const state = createTestBattleState({
      turnPhase: "enemy",
      playerHealth: 0,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 1,
      playerStunSkipTurns: 2,
      playerFreezeSkipTurns: 1,
      deck: [makeCard("d1"), makeCard("d2"), makeCard("d3"), makeCard("d4")],
      hand: [],
      turn: 1,
      rng: () => 0,
    });
    const result = advanceToPlayerTurn(state);
    expect(result.turnPhase).toBe("player");
    expect(result.playerStunSkipTurns).toBe(0);
    expect(result.playerFreezeSkipTurns).toBe(0);
  });
});

describe("isFreezeActiveForAspect", () => {
  it("returns false when enemy has no freeze skip", () => {
    const state = createTestBattleState({ enemyFreezeSkipTurns: 0 });
    expect(isFreezeActiveForAspect(state, "regen")).toBe(false);
  });

  it("respects freezeBlocksRegen for regen aspect", () => {
    const state = createTestBattleState({
      enemyFreezeSkipTurns: 1,
      talentEffects: { ...defaultTalentEffects, freezeBlocksRegen: true },
    });
    expect(isFreezeActiveForAspect(state, "regen")).toBe(true);
    expect(isFreezeActiveForAspect(state, "scaling")).toBe(false);
  });

  it("respects freezePreventsEnemyScaling for scaling aspect", () => {
    const state = createTestBattleState({
      enemyFreezeSkipTurns: 1,
      talentEffects: { ...defaultTalentEffects, freezePreventsEnemyScaling: true },
    });
    expect(isFreezeActiveForAspect(state, "scaling")).toBe(true);
  });
});

describe("checkHealthThresholds", () => {
  it("triggers block talent when crossing health threshold", () => {
    const state = createTestBattleState({
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, healthThresholdBlock: { threshold: 50, amount: 5 } },
    });
    const texts: CombatTextEvent[] = [];
    const result = checkHealthThresholds(20, 10, state, texts);
    expect(result.playerStatuses.block).toBe(5);
    expect(texts.some((t) => t.stat === "block")).toBe(true);
  });
});

describe("resolveDeathsDoorEndOfEnemyTurn", () => {
  it("clears Death's Door when player healed above 0", () => {
    const state = createTestBattleState({
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 1,
      playerHealth: 5,
    });
    const result = resolveDeathsDoorEndOfEnemyTurn(state);
    expect(result.deathsDoorActive).toBe(false);
    expect(result.deathsDoorGraceTurnsRemaining).toBeNull();
  });

  it("deactivates Death's Door when grace expires", () => {
    const state = createTestBattleState({
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      playerHealth: 0,
      turn: 2,
    });
    const result = resolveDeathsDoorEndOfEnemyTurn(state);
    expect(result.deathsDoorActive).toBe(false);
  });

  it("no-ops when Death's Door inactive", () => {
    const state = createTestBattleState();
    expect(resolveDeathsDoorEndOfEnemyTurn(state)).toBe(state);
  });
});
