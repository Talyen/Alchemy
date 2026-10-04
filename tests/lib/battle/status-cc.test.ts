import { describe, expect, it } from "vitest";
import {
  tryTriggerEnemyCc,
  finalizeCcSkipTurnDecrement,
  resolvePlayerCrowdControlTriggers,
} from "@/lib/battle/status-cc";
import { addEnemyStatus, addPlayerStatus } from "@/lib/battle";
import type { CombatTextEvent } from "@/lib/battle/types";
import { BATTLE_CONFIG, FREEZE_THRESHOLD_FRACTION } from "@/lib/game-constants";
import { makeTestBattleState } from "../../fixtures/battle";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultCcState,
} from "../../fixtures/default-battle-state";

describe("crowd-control thresholds", () => {
  it.each(["stun", "freeze"] as const)("banks %s below the threshold and triggers exactly at it", (stat) => {
    const below = makeTestBattleState({
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ [stat]: 14 }),
    });
    expect(resolvePlayerCrowdControlTriggers(below, [])).toBe(below);
    const state = { ...below, playerStatuses: { ...below.playerStatuses, [stat]: 15 } };
    const texts: CombatTextEvent[] = [];
    const next = resolvePlayerCrowdControlTriggers(state, texts);
    expect(next.playerStatuses[stat]).toBe(0);
    expect(next.playerCC).toEqual(defaultCcState({ [stat === "stun" ? "stunSkipTurns" : "freezeSkipTurns"]: 1 }));
    expect(texts).toEqual([{ target: "player", kind: "notice", stat, text: stat === "stun" ? "Stunned" : "Frozen" }]);
    expect(state.playerStatuses[stat]).toBe(15);
  });

  it("clears player buildup silently during immunity", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ freeze: 20 }),
      playerCC: defaultCcState({ cooldown: 2 }),
    });
    const texts: CombatTextEvent[] = [];
    const next = resolvePlayerCrowdControlTriggers(state, texts);
    expect(next.playerStatuses.freeze).toBe(0);
    expect(next.playerCC).toEqual(state.playerCC);
    expect(texts).toEqual([]);
  });

  it("uses pre-hit enemy Health and immunity without bypassing trigger guards", () => {
    const state = makeTestBattleState({ enemyHealth: 10, enemyStatuses: defaultEnemyStatusValues({ freeze: 15 }) });
    const texts: CombatTextEvent[] = [];
    const input = {
      nextState: state,
      stat: "freeze" as const,
      preHitHealth: 30,
      stackValue: 15,
      thresholdFraction: FREEZE_THRESHOLD_FRACTION,
      ccCooldown: 0,
      skipDuration: 2,
      combatTexts: texts,
    };
    expect(tryTriggerEnemyCc({ ...input, stackValue: 14 })).toBeNull();
    expect(tryTriggerEnemyCc({ ...input, nextState: { ...state, enemyHealth: 0 } })).toBeNull();
    expect(
      tryTriggerEnemyCc({ ...input, nextState: { ...state, enemyCC: defaultCcState({ stunSkipTurns: 1 }) } }),
    ).toBeNull();
    const immune = tryTriggerEnemyCc({ ...input, ccCooldown: 2 });
    expect(immune?.kind).toBe("immune");
    expect(immune?.state.enemyStatuses.freeze).toBe(0);
    expect(immune?.state.enemyCC.freezeSkipTurns).toBe(0);
    expect(texts).toEqual([]);
    const triggered = tryTriggerEnemyCc(input);
    expect(triggered?.kind).toBe("skip");
    expect(triggered?.state.enemyStatuses.freeze).toBe(0);
    expect(triggered?.state.enemyCC.freezeSkipTurns).toBe(2);
    expect(texts).toEqual([{ target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" }]);
    expect(state.enemyStatuses.freeze).toBe(15);
  });
});

describe("finalizeCcSkipTurnDecrement", () => {
  it("starts immunity when the last skip turn is consumed", () => {
    const prev = defaultCcState({ stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 });
    const next = defaultCcState({ stunSkipTurns: 0, freezeSkipTurns: 0, cooldown: 0 });
    expect(finalizeCcSkipTurnDecrement(prev, next).cooldown).toBe(BATTLE_CONFIG.CC_IMMUNITY_DURATION);
  });

  it("does not start immunity while skip turns remain", () => {
    const prev = defaultCcState({ stunSkipTurns: 2, freezeSkipTurns: 0, cooldown: 0 });
    const next = defaultCcState({ stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 });
    expect(finalizeCcSkipTurnDecrement(prev, next).cooldown).toBe(0);
  });
});

describe("stun/freeze buildup gate", () => {
  it("blocks enemy stun buildup during active CC", () => {
    const state = makeTestBattleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 0 }),
    });
    const next = addEnemyStatus(state, "stun", 10);
    expect(next.enemyStatuses.stun).toBe(0);
  });

  it("blocks player freeze buildup during CC immunity", () => {
    const state = makeTestBattleState({
      playerCC: defaultCcState({ cooldown: 2 }),
      playerStatuses: defaultPlayerStatusValues({ freeze: 0 }),
    });
    const next = addPlayerStatus(state, "freeze", 10);
    expect(next.playerStatuses.freeze).toBe(0);
  });
});

describe("resolvePlayerCrowdControlTriggers", () => {
  it("banks buildup while already controlled instead of extending or double-firing", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ stun: 20, freeze: 20 }),
      playerMaxHealth: 30,
      playerCC: defaultCcState({ stunSkipTurns: 1 }),
    });
    const texts: CombatTextEvent[] = [];
    const result = resolvePlayerCrowdControlTriggers(state, texts);
    expect(result).toBe(state);
    expect(texts).toEqual([]);
  });

  it("fires stun once when both stats cross threshold on the same packet", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ stun: 20, freeze: 20 }),
      playerMaxHealth: 30,
    });
    const texts: CombatTextEvent[] = [];
    const result = resolvePlayerCrowdControlTriggers(state, texts);
    expect(result.playerCC.stunSkipTurns).toBe(1);
    expect(result.playerCC.freezeSkipTurns).toBe(0);
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerStatuses.freeze).toBe(20);
    expect(texts).toEqual([{ target: "player", kind: "notice", stat: "stun", text: "Stunned" }]);
  });
});
