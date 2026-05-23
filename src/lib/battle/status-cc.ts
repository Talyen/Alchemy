// Crowd-control threshold checks, immunity, and skip-turn assignment.
// Enemy stun/freeze resolve on damage; player stun/freeze resolve in tickPlayerStatuses.
// Depends on combat-text, types, game-constants.
import { mergeCombatText } from "./combat-text";
import { BATTLE_CONFIG, STATUS_CONFIG } from "../game-constants";
import type { BattleState, CombatTextEvent } from "./types";

const CONSTANTS = {
  STATUS_NAMES: {
    STUN: "stun" as const,
    FREEZE: "freeze" as const,
  },
  TARGETS: {
    PLAYER: "player" as const,
    ENEMY: "enemy" as const,
  },
  COMBAT_TEXT_KINDS: {
    NOTICE: "notice" as const,
  },
  SKIP_FIELDS: {
    stun: {
      player: "playerStunSkipTurns" as const,
      enemy: "enemyStunSkipTurns" as const,
    },
    freeze: {
      player: "playerFreezeSkipTurns" as const,
      enemy: "enemyFreezeSkipTurns" as const,
    },
  },
} as const;

type CcStat = typeof CONSTANTS.STATUS_NAMES.STUN | typeof CONSTANTS.STATUS_NAMES.FREEZE;

function clearPlayerCcStack(state: BattleState, stat: CcStat): BattleState {
  return { ...state, playerStatuses: { ...state.playerStatuses, [stat]: 0 } };
}

function clearEnemyCcStack(state: BattleState, stat: CcStat): BattleState {
  return { ...state, enemyStatuses: { ...state.enemyStatuses, [stat]: 0 } };
}

export type PlayerCcTriggerInput = {
  state: BattleState;
  stat: CcStat;
  stackValue: number;
  thresholdFraction: number;
  combatTexts: CombatTextEvent[];
};

/** Player CC: checked after enemy attacks during tickPlayerStatuses. */
export function resolvePlayerCrowdControlTrigger(input: PlayerCcTriggerInput): BattleState {
  const { state, stat, stackValue, thresholdFraction, combatTexts } = input;
  if (stackValue <= 0) return state;
  if (state.playerHealth <= 0 || stackValue < state.playerMaxHealth * thresholdFraction) {
    return state;
  }
  if (state.playerCCCooldown > 0) {
    return clearPlayerCcStack(state, stat);
  }
  mergeCombatText(combatTexts, {
    target: CONSTANTS.TARGETS.PLAYER,
    kind: CONSTANTS.COMBAT_TEXT_KINDS.NOTICE,
    stat,
    text: stat === CONSTANTS.STATUS_NAMES.STUN ? STATUS_CONFIG.CC_NOTICE_STUN : STATUS_CONFIG.CC_NOTICE_FREEZE,
  });
  const skipField = CONSTANTS.SKIP_FIELDS[stat].player;
  return {
    ...clearPlayerCcStack(state, stat),
    [skipField]: state[skipField] + BATTLE_CONFIG.BASE_CC_DURATION,
    playerCCCooldown: BATTLE_CONFIG.CC_IMMUNITY_DURATION,
  };
}

export type EnemyCcImmunityInput = {
  nextState: BattleState;
  stat: CcStat;
  /** Pre-hit cooldown — enemy freeze checks state before stacks from this hit. */
  ccCooldown: number;
};

/** If enemy CC immunity is active, clear the stack on nextState without skipping. */
export function applyEnemyCcImmunityClear(input: EnemyCcImmunityInput): BattleState | null {
  if (input.ccCooldown == null || input.ccCooldown <= 0) return null;
  return clearEnemyCcStack(input.nextState, input.stat);
}

export type EnemyCcTriggerInput = {
  nextState: BattleState;
  stat: CcStat;
  skipDuration: number;
  combatTexts: CombatTextEvent[];
  postTrigger?: (state: BattleState) => BattleState;
};

/** Assigns enemy skip turns, cooldown, and notice after threshold was met. */
export function assignEnemyCrowdControlSkip(input: EnemyCcTriggerInput): BattleState {
  const { nextState, stat, skipDuration, combatTexts, postTrigger } = input;
  const skipField = CONSTANTS.SKIP_FIELDS[stat].enemy;
  let result: BattleState = {
    ...clearEnemyCcStack(nextState, stat),
    [skipField]: nextState[skipField] + skipDuration,
    enemyCCCooldown: BATTLE_CONFIG.CC_IMMUNITY_DURATION,
  };
  mergeCombatText(combatTexts, {
    target: CONSTANTS.TARGETS.ENEMY,
    kind: CONSTANTS.COMBAT_TEXT_KINDS.NOTICE,
    stat,
    text: stat === CONSTANTS.STATUS_NAMES.STUN ? STATUS_CONFIG.CC_NOTICE_STUN : STATUS_CONFIG.CC_NOTICE_FREEZE,
  });
  if (postTrigger) result = postTrigger(result);
  return result;
}
