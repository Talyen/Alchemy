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
  stat: ActiveCcKeyword;
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
  const skipKey = stat === "stun" ? "stunSkipTurns" : "freezeSkipTurns";
  let nextState: BattleState = {
    ...setPlayerStatus(state, stat, 0),
    playerCC: {
      ...state.playerCC,
      [skipKey]: state.playerCC[skipKey] + BATTLE_CONFIG.BASE_CC_DURATION,
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
  for (const stat of ["stun", "freeze"] as const) {
    // Stun takes priority; once controlled, bank the other stat for later.
    if (isCcControlled(state.playerCC)) break;
    state = resolvePlayerCrowdControlTrigger({
      state,
      stat,
      stackValue: state.playerStatuses[stat],
      thresholdFraction: stat === "stun" ? STUN_THRESHOLD_FRACTION : FREEZE_THRESHOLD_FRACTION,
      combatTexts,
    });
  }
  return state;
}

export interface EnemyCcTriggerCheckInput {
  preHitHealth: number;

  nextState: BattleState;
  stat: ActiveCcKeyword;
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
