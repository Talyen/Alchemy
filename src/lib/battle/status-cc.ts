/**
 * Crowd-control threshold checks, immunity, and skip-turn assignment.
 * Stun/freeze resolve when buildup crosses the threshold for either side.
 * Enemy triggers funnel through tryTriggerEnemyCc; the caller applies any
 * post-trigger payload (stun talents/gear or frozen-heart/gear freeze damage).
 * Depends on: ./combat-text, ./types, ../game-constants.
 * Depended on by: ./status-stun-resolve, ./damage-status-riders, ./status-ticks, ./enemy-turn-attack.
 */
import { mergeCombatText } from "./combat-text";
import { BATTLE_CONFIG, FREEZE_THRESHOLD_FRACTION, STATUS_CONFIG, STUN_THRESHOLD_FRACTION } from "../game-constants";
import {
  setEnemyStatus,
  setPlayerStatus,
  addPlayerStatus,
  type BattleState,
  type CcState,
  type CombatTextEvent,
  hasActiveCc,
} from "./types";

export type ActiveCcKeyword = "stun" | "freeze";
type CcStat = ActiveCcKeyword;

/** Overlay keyword while skip turns are active; stun wins when both are set. */
export function getActiveCcKeyword(cc: CcState): ActiveCcKeyword | null {
  if (cc.stunSkipTurns > 0) return "stun";
  if (cc.freezeSkipTurns > 0) return "freeze";
  return null;
}

export function isPlayerCcControlled(cc: CcState): boolean {
  return cc.stunSkipTurns > 0 || cc.freezeSkipTurns > 0;
}

export { hasActiveCc, isStunFreezeBuildupBlocked } from "./types/state-types";
export function finalizeCcSkipTurnDecrement(prev: CcState, next: CcState): CcState {
  if (hasActiveCc(prev) && !hasActiveCc(next)) {
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

/** Player CC threshold is a fraction of playerMaxHealth. CC cooldown prevents immediate re-CC. */
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
  /** Pre-hit cooldown — enemy freeze checks state before stacks from this hit. */
  ccCooldown: number;
}

/** If enemy CC immunity is active, clear the stack on nextState without skipping. */
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

/** Assigns enemy skip turns, cooldown, and notice after threshold was met. */
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
  /** Health before the triggering hit — stun/freeze thresholds are checked against pre-hit health. */
  preHitHealth: number;
  /** State after the triggering stack was added. */
  nextState: BattleState;
  stat: CcStat;
  stackValue: number;
  thresholdFraction: number;
  ccCooldown: number;
  skipDuration: number;
  combatTexts: CombatTextEvent[];
}

export type EnemyCcTriggerResult = { kind: "skip"; state: BattleState } | { kind: "immune"; state: BattleState };

/**
 * Runs the canonical enemy CC trigger: threshold check against pre-hit health,
 * then either immunity clear (cooldown) or skip+notice assignment. Returns null
 * when the threshold is not met. The caller applies post-trigger payload (stun
 * talents/gear or frozen-heart/gear freeze damage) only on the "skip" branch.
 */
export function tryTriggerEnemyCc(input: EnemyCcTriggerCheckInput): EnemyCcTriggerResult | null {
  const { preHitHealth, nextState, stat, stackValue, thresholdFraction, ccCooldown, skipDuration, combatTexts } = input;
  if (preHitHealth <= 0 || stackValue < preHitHealth * thresholdFraction) return null;
  const immuneClear = applyEnemyCcImmunityClear({ nextState, stat, ccCooldown });
  if (immuneClear) return { kind: "immune", state: immuneClear };
  return { kind: "skip", state: assignEnemyCrowdControlSkip({ nextState, stat, skipDuration, combatTexts }) };
}
