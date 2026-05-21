import { describe, expect, it } from "vitest";
import {
  applyEnemyCcImmunityClear,
  assignEnemyCrowdControlSkip,
  resolvePlayerCrowdControlTrigger,
} from "@/lib/battle/status-cc";
import { BATTLE_CONFIG, FREEZE_THRESHOLD_FRACTION, STUN_THRESHOLD_FRACTION } from "@/lib/game-constants";
import { createTestBattleState } from "./test-state";

describe("resolvePlayerCrowdControlTrigger", () => {
  it("clears stun without skip when below threshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, stun: 5 },
      playerMaxHealth: 30,
    });
    const texts: never[] = [];
    const result = resolvePlayerCrowdControlTrigger({
      state,
      stat: "stun",
      stackValue: 5,
      thresholdFraction: STUN_THRESHOLD_FRACTION,
      combatTexts: texts,
    });
    expect(result.playerStunSkipTurns).toBe(0);
    expect(result.playerStatuses.stun).toBe(5);
  });

  it("assigns skip and immunity when stun meets threshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, stun: 20 },
      playerMaxHealth: 30,
    });
    const texts: Parameters<typeof resolvePlayerCrowdControlTrigger>[0]["combatTexts"] = [];
    const result = resolvePlayerCrowdControlTrigger({
      state,
      stat: "stun",
      stackValue: 20,
      thresholdFraction: STUN_THRESHOLD_FRACTION,
      combatTexts: texts,
    });
    expect(result.playerStunSkipTurns).toBe(BATTLE_CONFIG.BASE_CC_DURATION);
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCCCooldown).toBe(BATTLE_CONFIG.CC_IMMUNITY_DURATION);
  });

  it("clears freeze silently during player CC immunity", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, freeze: 20 },
      playerCCCooldown: 2,
    });
    const result = resolvePlayerCrowdControlTrigger({
      state,
      stat: "freeze",
      stackValue: 20,
      thresholdFraction: FREEZE_THRESHOLD_FRACTION,
      combatTexts: [],
    });
    expect(result.playerStatuses.freeze).toBe(0);
    expect(result.playerFreezeSkipTurns).toBe(0);
  });
});

describe("enemy CC helpers", () => {
  it("applyEnemyCcImmunityClear zeros freeze on pre-hit cooldown", () => {
    const preHit = createTestBattleState({ enemyCCCooldown: 2 });
    const afterStacks = createTestBattleState({
      enemyStatuses: { ...preHit.enemyStatuses, freeze: 20 },
    });
    const cleared = applyEnemyCcImmunityClear({
      nextState: afterStacks,
      stat: "freeze",
      ccCooldown: preHit.enemyCCCooldown,
    });
    expect(cleared?.enemyStatuses.freeze).toBe(0);
    expect(cleared?.enemyFreezeSkipTurns).toBe(0);
  });

  it("assignEnemyCrowdControlSkip increments enemy stun skip", () => {
    const state = createTestBattleState({
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
    });
    const result = assignEnemyCrowdControlSkip({
      nextState: state,
      stat: "stun",
      skipDuration: BATTLE_CONFIG.BASE_CC_DURATION,
      combatTexts: [],
    });
    expect(result.enemyStunSkipTurns).toBe(BATTLE_CONFIG.BASE_CC_DURATION);
    expect(result.enemyStatuses.stun).toBe(0);
  });
});
