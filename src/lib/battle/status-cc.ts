import { recordEnemyAbilityActivation } from "./battle-metrics";
import { mergeCombatText } from "./combat-text-events";
import { applyArmorReward } from "./status-player";
import { BATTLE_CONFIG, FREEZE_THRESHOLD_FRACTION, STATUS_CONFIG, STUN_THRESHOLD_FRACTION } from "../game-constants";
import {
  setEnemyStatus,
  setPlayerStatus,
  addEnemyMitigation,
  hasEnemyTrait,
  isPlayerDefeated,
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

export function isCcControlled(cc: CcState): boolean {
  return cc.stunSkipTurns > 0 || cc.freezeSkipTurns > 0;
}

export function finalizeCcSkipTurnDecrement(prev: CcState, next: CcState): CcState {
  if (isCcControlled(prev) && !isCcControlled(next)) {
    return { ...next, cooldown: BATTLE_CONFIG.CC_IMMUNITY_DURATION };
  }
  return next;
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
    return setPlayerStatus(state, stat, 0);
  }
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "notice",
    stat,
    text: stat === "stun" ? STATUS_CONFIG.CC_NOTICE_STUN : STATUS_CONFIG.CC_NOTICE_FREEZE,
  });
  let nextState: BattleState = {
    ...setPlayerStatus(state, stat, 0),
    playerCC: {
      ...state.playerCC,
      ...(stat === "stun"
        ? { stunSkipTurns: state.playerCC.stunSkipTurns + BATTLE_CONFIG.BASE_CC_DURATION }
        : { freezeSkipTurns: state.playerCC.freezeSkipTurns + BATTLE_CONFIG.BASE_CC_DURATION }),
    },
  };

  if (state.gearEffects.armorOnStunOrFreeze > 0) {
    const armorAmount = state.gearEffects.armorOnStunOrFreeze;
    nextState = applyArmorReward(nextState, armorAmount, combatTexts);
  }

  if (stat === "freeze" && hasEnemyTrait(state, "yeti")) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "block", amount: 1 });
    nextState = addEnemyMitigation(recordEnemyAbilityActivation(nextState, "yeti"), "block", 1);
  }

  return nextState;
}

export function resolvePlayerCrowdControlTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  // Mirror the enemy guard in tryTriggerEnemyCc: while controlled, new buildup
  // banks for later instead of extending the skip or firing the other stat on
  // a follow-up packet of the same attack.
  if (isCcControlled(state.playerCC)) return state;
  let nextState = resolvePlayerCrowdControlTrigger({
    state,
    stat: "stun",
    stackValue: state.playerStatuses.stun,
    thresholdFraction: STUN_THRESHOLD_FRACTION,
    combatTexts,
  });
  // A stun that just fired controls the player; don't also freeze on the same packet.
  if (isCcControlled(nextState.playerCC)) return nextState;
  nextState = resolvePlayerCrowdControlTrigger({
    state: nextState,
    stat: "freeze",
    stackValue: nextState.playerStatuses.freeze,
    thresholdFraction: FREEZE_THRESHOLD_FRACTION,
    combatTexts,
  });
  return nextState;
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
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return null;
  if (isCcControlled(nextState.enemyCC)) return null;
  if (preHitHealth <= 0 || stackValue < preHitHealth * thresholdFraction) return null;
  const cleared = setEnemyStatus(nextState, stat, 0);
  if (ccCooldown > 0) return { kind: "immune", state: cleared };
  const skipKey = stat === "stun" ? "stunSkipTurns" : "freezeSkipTurns";
  const state = {
    ...cleared,
    enemyCC: { ...cleared.enemyCC, [skipKey]: cleared.enemyCC[skipKey] + skipDuration },
  };
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "notice",
    stat,
    text: stat === "stun" ? STATUS_CONFIG.CC_NOTICE_STUN : STATUS_CONFIG.CC_NOTICE_FREEZE,
  });
  return { kind: "skip", state };
}
