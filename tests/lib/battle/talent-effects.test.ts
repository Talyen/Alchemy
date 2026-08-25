import { describe, expect, it } from "vitest";
import { applyCrowdControlTriggerBonuses } from "@/lib/battle/talent-effects";
import { defaultTalentEffects } from "@/lib/battle";
import { FREE_CARD_SENTINEL } from "@/lib/game-constants";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestBattleState, makeTestCardWithId } from "../../fixtures/battle";

describe("applyCrowdControlTriggerBonuses", () => {
  it("no-ops when all bonuses are empty", () => {
    const state = makeTestBattleState({
      deck: [makeTestCardWithId("d1")],
      hand: [],
    });
    const result = applyCrowdControlTriggerBonuses(state, {});
    expect(result).toBe(state);
  });

  it("draws N cards", () => {
    const state = makeTestBattleState({
      deck: [makeTestCardWithId("d1"), makeTestCardWithId("d2"), makeTestCardWithId("d3")],
      hand: [],
      discard: [],
      rng: () => 0,
    });
    const result = applyCrowdControlTriggerBonuses(state, { draw: 2 });
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
  });

  it("sets FREE_CARD_SENTINEL when nextCardFree is true", () => {
    const result = applyCrowdControlTriggerBonuses(makeTestBattleState(), { nextCardFree: true });
    expect(result.flags.nextCardCostReduction).toBe(FREE_CARD_SENTINEL);
  });

  it("adds combined block once so flatBlockGained applies a single time", () => {
    const state = makeTestBattleState({
      talentEffects: { ...defaultTalentEffects, blockOnStun: 4 },
      gearEffects: { ...makeTestBattleState().gearEffects, flatBlockGained: 2, blockOnStun: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCrowdControlTriggerBonuses(state, { block: 4 + 3 }, texts);
    expect(result.playerStatuses.block).toBe(9);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 9 }]);
  });

  it("grants forge through addForgeToPlayer", () => {
    const texts: CombatTextEvent[] = [];
    const result = applyCrowdControlTriggerBonuses(makeTestBattleState(), { forge: 2 }, texts);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("strips enemy armor", () => {
    const state = makeTestBattleState({
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, armor: 5 },
    });
    const result = applyCrowdControlTriggerBonuses(state, { stripArmor: true });
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("strips enemy Block", () => {
    const state = makeTestBattleState({
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, block: 6 },
    });
    const result = applyCrowdControlTriggerBonuses(state, { stripBlock: true });
    expect(result.enemyMitigation.block).toBe(0);
  });

  it("restores mana and emits combat text", () => {
    const state = makeTestBattleState({ mana: 1 });
    const texts: CombatTextEvent[] = [];
    const result = applyCrowdControlTriggerBonuses(state, { mana: 2 }, texts);
    expect(result.mana).toBe(3);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "mana", amount: 2 }]);
  });
});
