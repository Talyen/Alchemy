import { describe, expect, it } from "vitest";
import {
  advanceToPlayerTurn,
  resetEnemyTurnState,
  resolveDeathsDoorGraceExpiry,
} from "@/lib/battle/player-turn-transition";
import { checkHealthThresholds } from "@/lib/battle/enemy-attack-damage";
import {
  isEveryOtherTurnScalingTurn,
  isFreezeActiveForAspect,
  scaleByRoomMultiplier,
} from "@/lib/battle/enemy-turn-traits";
import { getEnemyTraitSet, hasEnemyTrait } from "@/lib/battle/types";
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
      playerStatuses: defaultPlayerStatusValues({ block: 9 }),
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

  it("advances to player turn and draws cards even when player CC is active", () => {
    const state = makeTestBattleState({
      turnPhase: "enemy",
      playerCC: defaultCcState({ stunSkipTurns: 1 }),
      deck: [makeTestCardWithId("d1"), makeTestCardWithId("d2")],
      hand: [],
    });
    const result = advanceToPlayerTurn(state);
    expect(result.turnPhase).toBe("player");
    expect(result.hand).toHaveLength(2);
    expect(result.playerCC.stunSkipTurns).toBe(1);
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
  it("applies a configured bonus only when health crosses its threshold", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerMaxHealth: 30,
      talentEffects: { ...base.talentEffects, healthThresholdBlock: { threshold: 50, amount: 4 } },
    });
    expect(checkHealthThresholds(20, 10, state, []).playerStatuses.block).toBe(4);
    expect(checkHealthThresholds(10, 9, state, [])).toBe(state);
  });

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

  it("fires every healthThresholdArmor crossing independently", () => {
    const state = makeTestBattleState({
      playerMaxHealth: 100,
      talentEffects: {
        ...defaultTalentEffects,
        healthThresholdArmor: [
          { threshold: 50, amount: 5 },
          { threshold: 25, amount: 3 },
        ],
      },
    });
    const texts: CombatTextEvent[] = [];
    const mid = checkHealthThresholds(80, 40, state, texts);
    expect(mid.playerStatuses.armor).toBe(5);
    const low = checkHealthThresholds(40, 20, mid, texts);
    expect(low.playerStatuses.armor).toBe(8);
  });

  it("applies flatArmorAmount when health-threshold armor triggers", () => {
    const state = makeTestBattleState({
      playerMaxHealth: 30,
      talentEffects: {
        ...defaultTalentEffects,
        healthThresholdArmor: [{ threshold: 50, amount: 5 }],
        flatArmorAmount: 1,
      },
    });
    const result = checkHealthThresholds(20, 10, state, []);
    expect(result.playerStatuses.armor).toBe(6);
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

describe("enemy turn scaling rules", () => {
  it("keeps scaling and freeze checks pure", () => {
    const state = makeTestBattleState({
      turn: 2,
      roomScalingMultiplier: 1.5,
      enemyCC: { ...makeTestBattleState().enemyCC, freezeSkipTurns: 1 },
      talentEffects: { ...makeTestBattleState().talentEffects, freezeBlocksRegen: true },
    });
    expect(isEveryOtherTurnScalingTurn(state)).toBe(true);
    expect(scaleByRoomMultiplier(state, 3)).toBe(5);
    expect(isFreezeActiveForAspect(state, "regen")).toBe(true);
  });
});

describe("enemy trait query", () => {
  it("supports direct and cached trait lookup", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      currentEnemy: {
        ...base.currentEnemy,
        traits: [{ id: "vampire", title: "Vampire", description: "" }],
      },
    });
    const traits = getEnemyTraitSet(state);
    expect(hasEnemyTrait(state, "vampire")).toBe(true);
    expect(hasEnemyTrait(state, "vampire", traits)).toBe(true);
    expect(hasEnemyTrait(state, "cleric", traits)).toBe(false);
  });
});
