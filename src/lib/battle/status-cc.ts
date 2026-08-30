import { mergeCombatText } from "./combat-text";
import { BATTLE_CONFIG, FREEZE_THRESHOLD_FRACTION, STATUS_CONFIG, STUN_THRESHOLD_FRACTION } from "../game-constants";
import { hasEnemyTrait } from "./enemy-turn-attack";
import {
  setEnemyStatus,
  setPlayerStatus,
  addPlayerStatus,
  addEnemyMitigation,
  type BattleState,
  type CcState,
  type CombatTextEvent,
} from "./types";

export type ActiveCcKeyword = "stun" | "freeze";
type CcStat = ActiveCcKeyword;

export function getActiveCcKeyword(cc: CcState): ActiveCcKeyword | null {
  if (cc.stunSkipTurns > 0) return "stun";
  if (cc.freezeSkipTurns > 0) return "freeze";
  return null;
}

export function isPlayerCcControlled(cc: CcState): boolean {
  return cc.stunSkipTurns > 0 || cc.freezeSkipTurns > 0;
}

export function finalizeCcSkipTurnDecrement(prev: CcState, next: CcState): CcState {
  if (isPlayerCcControlled(prev) && !isPlayerCcControlled(next)) {
    return { ...next, cooldown: BATTLE_CONFIG.CC_IMMUNITY_DURATION };
  }
  return next;
}

function clearPlayerCcStack(state: BattleState, stat: CcStat): BattleState {
  return setPlayerStatus(state, stat, 0);
}

function clearEnemyCcStack(state: BattleState, stat: CcStat): BattleState {
  return setEnemyStatus(state, stat, 0);
}

export interface PlayerCcTriggerInput {
  state: BattleState;
  stat: CcStat;
  stackValue: number;
  thresholdFraction: number;
  combatTexts: CombatTextEvent[];
}

export function resolvePlayerCrowdControlTrigger(input: PlayerCcTriggerInput): BattleState {
  const { state, stat, stackValue, thresholdFraction, combatTexts } = input;
  if (stackValue <= 0) return state;
  if (state.playerHealth <= 0 || stackValue < state.playerMaxHealth * thresholdFraction) {
    return state;
  }
  if (state.playerCC.cooldown > 0) {
    return clearPlayerCcStack(state, stat);
  }
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "notice",
    stat,
    text: stat === "stun" ? STATUS_CONFIG.CC_NOTICE_STUN : STATUS_CONFIG.CC_NOTICE_FREEZE,
  });
  let nextState: BattleState = {
    ...clearPlayerCcStack(state, stat),
    playerCC: {
      ...state.playerCC,
      ...(stat === "stun"
        ? { stunSkipTurns: state.playerCC.stunSkipTurns + BATTLE_CONFIG.BASE_CC_DURATION }
        : { freezeSkipTurns: state.playerCC.freezeSkipTurns + BATTLE_CONFIG.BASE_CC_DURATION }),
    },
  };

  if (state.gearEffects.armorOnStunOrFreeze > 0) {
    const armorAmount = state.gearEffects.armorOnStunOrFreeze;
    nextState = addPlayerStatus(nextState, "armor", armorAmount);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "armor",
      amount: armorAmount,
    });
  }

  if (stat === "freeze" && hasEnemyTrait(state, "yeti")) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "block", amount: 1 });
    nextState = addEnemyMitigation(nextState, "block", 1);
  }

  return nextState;
}

export function resolvePlayerCrowdControlTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = resolvePlayerCrowdControlTrigger({
    state,
    stat: "stun",
    stackValue: state.playerStatuses.stun,
    thresholdFraction: STUN_THRESHOLD_FRACTION,
    combatTexts,
  });
  nextState = resolvePlayerCrowdControlTrigger({
    state: nextState,
    stat: "freeze",
    stackValue: nextState.playerStatuses.freeze,
    thresholdFraction: FREEZE_THRESHOLD_FRACTION,
    combatTexts,
  });
  return nextState;
}

export interface EnemyCcImmunityInput {
  nextState: BattleState;
  stat: CcStat;

  ccCooldown: number;
}

export function applyEnemyCcImmunityClear(input: EnemyCcImmunityInput): BattleState | null {
  if (input.ccCooldown <= 0) return null;
  return clearEnemyCcStack(input.nextState, input.stat);
}

export interface EnemyCcTriggerInput {
  nextState: BattleState;
  stat: CcStat;
  skipDuration: number;
  combatTexts: CombatTextEvent[];
  postTrigger?: (state: BattleState) => BattleState;
}

export function assignEnemyCrowdControlSkip(input: EnemyCcTriggerInput): BattleState {
  const { nextState, stat, skipDuration, combatTexts, postTrigger } = input;
  let result: BattleState = {
    ...clearEnemyCcStack(nextState, stat),
    enemyCC: {
      ...nextState.enemyCC,
      ...(stat === "stun"
        ? { stunSkipTurns: nextState.enemyCC.stunSkipTurns + skipDuration }
        : { freezeSkipTurns: nextState.enemyCC.freezeSkipTurns + skipDuration }),
    },
  };
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "notice",
    stat,
    text: stat === "stun" ? STATUS_CONFIG.CC_NOTICE_STUN : STATUS_CONFIG.CC_NOTICE_FREEZE,
  });
  if (postTrigger) result = postTrigger(result);
  return result;
}

export interface EnemyCcTriggerCheckInput {
  preHitHealth: number;

  nextState: BattleState;
  stat: CcStat;
  stackValue: number;
  thresholdFraction: number;
  ccCooldown: number;
  skipDuration: number;
  combatTexts: CombatTextEvent[];
}

export type EnemyCcTriggerResult = { kind: "skip"; state: BattleState } | { kind: "immune"; state: BattleState };

export function tryTriggerEnemyCc(input: EnemyCcTriggerCheckInput): EnemyCcTriggerResult | null {
  const { preHitHealth, nextState, stat, stackValue, thresholdFraction, ccCooldown, skipDuration, combatTexts } = input;
  if (preHitHealth <= 0 || stackValue < preHitHealth * thresholdFraction) return null;
  const immuneClear = applyEnemyCcImmunityClear({ nextState, stat, ccCooldown });
  if (immuneClear) return { kind: "immune", state: immuneClear };
  return { kind: "skip", state: assignEnemyCrowdControlSkip({ nextState, stat, skipDuration, combatTexts }) };
}
