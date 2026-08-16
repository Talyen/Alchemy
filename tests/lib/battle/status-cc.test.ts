import { describe, expect, it } from "vitest";
import {
  applyEnemyCcImmunityClear,
  assignEnemyCrowdControlSkip,
  resolvePlayerCrowdControlTrigger,
} from "@/lib/battle/status-cc";
import { BATTLE_CONFIG, FREEZE_THRESHOLD_FRACTION, STUN_THRESHOLD_FRACTION } from "@/lib/game-constants";
import { makeTestBattleState } from "../../fixtures/battle";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultCcState,
} from "../../fixtures/default-battle-state";

describe("resolvePlayerCrowdControlTrigger", () => {
  it("clears stun without skip when below threshold", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ stun: 5 }),
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
    expect(result.playerCC.stunSkipTurns).toBe(0);
    expect(result.playerStatuses.stun).toBe(5);
  });

  it("assigns skip and immunity when stun meets threshold", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ stun: 20 }),
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
    expect(result.playerCC.stunSkipTurns).toBe(BATTLE_CONFIG.BASE_CC_DURATION);
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCC.cooldown).toBe(BATTLE_CONFIG.CC_IMMUNITY_DURATION);
  });

  it("stun triggers at exactly half max health (>= boundary, even health)", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ stun: 15 }),
      playerMaxHealth: 30,
    });
    const result = resolvePlayerCrowdControlTrigger({
      state,
      stat: "stun",
      stackValue: 15,
      thresholdFraction: STUN_THRESHOLD_FRACTION,
      combatTexts: [],
    });
    expect(result.playerCC.stunSkipTurns).toBe(BATTLE_CONFIG.BASE_CC_DURATION);
  });

  it("stun does not trigger one stack below half max health", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ stun: 14 }),
      playerMaxHealth: 30,
    });
    const texts: never[] = [];
    const result = resolvePlayerCrowdControlTrigger({
      state,
      stat: "stun",
      stackValue: 14,
      thresholdFraction: STUN_THRESHOLD_FRACTION,
      combatTexts: texts,
    });
    expect(result.playerCC.stunSkipTurns).toBe(0);
    expect(result.playerStatuses.stun).toBe(14);
  });

  it("freeze triggers at exactly half max health (>= boundary, even health)", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ freeze: 15 }),
      playerMaxHealth: 30,
    });
    const result = resolvePlayerCrowdControlTrigger({
      state,
      stat: "freeze",
      stackValue: 15,
      thresholdFraction: FREEZE_THRESHOLD_FRACTION,
      combatTexts: [],
    });
    expect(result.playerCC.freezeSkipTurns).toBe(BATTLE_CONFIG.BASE_CC_DURATION);
  });

  it("clears freeze silently during player CC immunity", () => {
    const state = makeTestBattleState({
      playerStatuses: defaultPlayerStatusValues({ freeze: 20 }),
      playerCC: defaultCcState({ cooldown: 2 }),
    });
    const result = resolvePlayerCrowdControlTrigger({
      state,
      stat: "freeze",
      stackValue: 20,
      thresholdFraction: FREEZE_THRESHOLD_FRACTION,
      combatTexts: [],
    });
    expect(result.playerStatuses.freeze).toBe(0);
    expect(result.playerCC.freezeSkipTurns).toBe(0);
  });
});

describe("enemy CC helpers", () => {
  it("applyEnemyCcImmunityClear zeros freeze on pre-hit cooldown", () => {
    const preHit = makeTestBattleState({ enemyCC: defaultCcState({ cooldown: 2 }) });
    const afterStacks = makeTestBattleState({
      enemyStatuses: defaultEnemyStatusValues({ freeze: 20 }),
    });
    const cleared = applyEnemyCcImmunityClear({
      nextState: afterStacks,
      stat: "freeze",
      ccCooldown: preHit.enemyCC.cooldown,
    });
    expect(cleared?.enemyStatuses.freeze).toBe(0);
    expect(cleared?.enemyCC.freezeSkipTurns).toBe(0);
  });

  it("assignEnemyCrowdControlSkip increments enemy stun skip", () => {
    const state = makeTestBattleState({
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
    });
    const result = assignEnemyCrowdControlSkip({
      nextState: state,
      stat: "stun",
      skipDuration: BATTLE_CONFIG.BASE_CC_DURATION,
      combatTexts: [],
    });
    expect(result.enemyCC.stunSkipTurns).toBe(BATTLE_CONFIG.BASE_CC_DURATION);
    expect(result.enemyStatuses.stun).toBe(0);
  });

  it("assignEnemyCrowdControlSkip increments enemy freeze skip", () => {
    const state = makeTestBattleState({
      enemyStatuses: defaultEnemyStatusValues({ freeze: 20 }),
    });
    const result = assignEnemyCrowdControlSkip({
      nextState: state,
      stat: "freeze",
      skipDuration: BATTLE_CONFIG.BASE_CC_DURATION,
      combatTexts: [],
    });
    expect(result.enemyCC.freezeSkipTurns).toBe(BATTLE_CONFIG.BASE_CC_DURATION);
    expect(result.enemyStatuses.freeze).toBe(0);
  });
});
