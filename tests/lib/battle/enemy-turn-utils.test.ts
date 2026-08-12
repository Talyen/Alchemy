import { describe, expect, it } from "vitest";
import {
  advanceToPlayerTurn,
  checkHealthThresholds,
  isFreezeActiveForAspect,
  resetEnemyTurnState,
  resolveDeathsDoorGraceExpiry,
} from "@/lib/battle/enemy-turn-utils";
import { defaultTalentEffects } from "@/lib/battle";
import { CARDS_PER_TURN } from "@/lib/game-constants";
import { defaultGearEffects } from "@/lib/gear";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestBattleState, makeTestCardWithId } from "../../fixtures/battle";
import { defaultPlayerStatusValues, defaultCcState } from "../../fixtures/default-battle-state";

describe("advanceToPlayerTurn", () => {
  it("draws CARDS_PER_TURN and sets mana to maxMana", () => {
    const state = makeTestBattleState({
      turnPhase: "enemy",
      deck: [
        makeTestCardWithId("d1"),
        makeTestCardWithId("d2"),
        makeTestCardWithId("d3"),
        makeTestCardWithId("d4"),
        makeTestCardWithId("d5"),
      ],
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
    const state = makeTestBattleState({
      turnPhase: "enemy",
      playerStatuses: defaultPlayerStatusValues({ ...makeTestBattleState().playerStatuses, block: 9 }),
      deck: [makeTestCardWithId("d1")],
      rng: () => 0,
    });
    const result = advanceToPlayerTurn(state);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("adds wellspring bonus when unspent mana", () => {
    const state = makeTestBattleState({
      turnPhase: "enemy",
      mana: 2,
      maxMana: 4,
      deck: [makeTestCardWithId("d1")],
      talentEffects: { ...defaultTalentEffects, wellspringKeepMana: 1 },
      rng: () => 0,
    });
    const result = advanceToPlayerTurn(state);
    expect(result.mana).toBe(5);
  });

  it("CC skip: no draw when stun skip active", () => {
    const state = makeTestBattleState({
      turnPhase: "enemy",
      playerCC: defaultCcState({ stunSkipTurns: 1 }),
      deck: [makeTestCardWithId("d1"), makeTestCardWithId("d2")],
      hand: [],
    });
    const result = advanceToPlayerTurn(state);
    expect(result.turnPhase).toBe("enemy");
    expect(result.hand).toHaveLength(0);
    expect(result.playerCC.stunSkipTurns).toBe(0);
  });

  it("Death's Door recovery suppresses CC skip", () => {
    const state = makeTestBattleState({
      turnPhase: "enemy",
      playerHealth: 0,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 1,
      playerCC: defaultCcState({ stunSkipTurns: 2, freezeSkipTurns: 1 }),
      deck: [makeTestCardWithId("d1"), makeTestCardWithId("d2"), makeTestCardWithId("d3"), makeTestCardWithId("d4")],
      hand: [],
      turn: 1,
      rng: () => 0,
    });
    const result = advanceToPlayerTurn(state);
    expect(result.turnPhase).toBe("player");
    expect(result.playerCC.stunSkipTurns).toBe(0);
    expect(result.playerCC.freezeSkipTurns).toBe(0);
  });

  it("heals from gear healthPerTurn and emits combat text", () => {
    const state = makeTestBattleState({
      turnPhase: "enemy",
      playerHealth: 10,
      playerMaxHealth: 30,
      deck: [makeTestCardWithId("d1"), makeTestCardWithId("d2"), makeTestCardWithId("d3")],
      hand: [],
      gearEffects: { ...defaultGearEffects, healthPerTurn: 4 },
      rng: () => 0,
    });
    const texts: CombatTextEvent[] = [];
    const result = advanceToPlayerTurn(state, texts);
    expect(result.playerHealth).toBe(14);
    expect(texts.some((t) => t.kind === "heal" && t.amount === 4)).toBe(true);
  });

  it("healthPerTurn combat text uses actual health gained near max HP", () => {
    const state = makeTestBattleState({
      turnPhase: "enemy",
      playerHealth: 29,
      playerMaxHealth: 30,
      deck: [makeTestCardWithId("d1"), makeTestCardWithId("d2"), makeTestCardWithId("d3")],
      hand: [],
      gearEffects: { ...defaultGearEffects, healthPerTurn: 4 },
      rng: () => 0,
    });
    const texts: CombatTextEvent[] = [];
    const result = advanceToPlayerTurn(state, texts);
    expect(result.playerHealth).toBe(30);
    expect(texts.find((t) => t.kind === "heal")).toEqual({
      target: "player",
      kind: "heal",
      stat: "health",
      amount: 1,
    });
  });
});

describe("resetEnemyTurnState", () => {
  it("halves enemy block at the start of the enemy turn", () => {
    const state = makeTestBattleState({
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, block: 9 },
    });
    const result = resetEnemyTurnState(state);
    expect(result.enemyMitigation.block).toBe(5);
  });
});

describe("isFreezeActiveForAspect", () => {
  it("returns false when enemy has no freeze skip", () => {
    const state = makeTestBattleState({ enemyCC: defaultCcState({ freezeSkipTurns: 0 }) });
    expect(isFreezeActiveForAspect(state, "regen")).toBe(false);
  });

  it("respects freezeBlocksRegen for regen aspect", () => {
    const state = makeTestBattleState({
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, freezeBlocksRegen: true },
    });
    expect(isFreezeActiveForAspect(state, "regen")).toBe(true);
    expect(isFreezeActiveForAspect(state, "scaling")).toBe(false);
  });

  it("respects freezePreventsEnemyScaling for scaling aspect", () => {
    const state = makeTestBattleState({
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, freezePreventsEnemyScaling: true },
    });
    expect(isFreezeActiveForAspect(state, "scaling")).toBe(true);
  });
});

describe("checkHealthThresholds", () => {
  it("triggers block talent when crossing health threshold", () => {
    const state = makeTestBattleState({
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, healthThresholdBlock: { threshold: 50, amount: 5 } },
    });
    const texts: CombatTextEvent[] = [];
    const result = checkHealthThresholds(20, 10, state, texts);
    expect(result.playerStatuses.block).toBe(5);
    expect(texts.some((t) => t.stat === "block")).toBe(true);
  });
});

describe("resolveDeathsDoorGraceExpiry", () => {
  it("deactivates Death's Door when grace expires", () => {
    const state = makeTestBattleState({
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      deathsDoorGraceTurnsRemaining: 0,
      playerHealth: 1,
      turn: 2,
    });
    const result = resolveDeathsDoorGraceExpiry(state);
    expect(result.deathsDoorActive).toBe(false);
    expect(result.playerHealth).toBe(1);
  });

  it("no-ops when Death's Door inactive", () => {
    const state = makeTestBattleState();
    expect(resolveDeathsDoorGraceExpiry(state)).toBe(state);
  });
});
