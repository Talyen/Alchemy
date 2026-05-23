// Enemy attack status application to the player (harmful stacks and rare beneficial buffs).
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { EnemyAttackEffect, PlayerStatusId } from "@/lib/game-data/types";
import { mergeCombatText } from "./combat-text";
import type { BattleState, CombatTextEvent } from "./types";

const CONSTANTS = {
  STATUS_NAMES: {
    FREEZE: "freeze",
    BLEED: "bleed",
    POISON: "poison",
    STUN: "stun",
    ARMOR: "armor",
    BLOCK: "block",
  },
  TARGETS: {
    PLAYER: "player",
  },
  COMBAT_TEXT_KINDS: {
    DAMAGE: "damage",
    STATUS: "status",
  },
} as const;

function computeAttackStatusAmount(state: BattleState, status: PlayerStatusId, baseAmount: number) {
  const extraFreeze = status === CONSTANTS.STATUS_NAMES.FREEZE ? state.enemyMitigation.freezeBonus : 0;
  return baseAmount + extraFreeze;
}

function shouldBlockPreventStatus(state: BattleState, status: PlayerStatusId) {
  if (state.playerStatuses.block <= 0) return false;
  if (status === CONSTANTS.STATUS_NAMES.BLEED && state.talentEffects.blockPreventsBleed) return true;
  if (status === CONSTANTS.STATUS_NAMES.POISON && state.talentEffects.blockPreventsPoison) return true;
  if (status === CONSTANTS.STATUS_NAMES.STUN && state.talentEffects.blockPreventsStun) return true;
  return false;
}

function applyHarmfulStatusFromAttack(
  state: BattleState,
  status: PlayerStatusId,
  amount: number,
  blockPreventsStatus: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (!blockPreventsStatus && state.trinketEffects.plagueDoctorImmunity && !state.flags.firstHarmfulStatusPrevented) {
    return { ...state, flags: { ...state.flags, firstHarmfulStatusPrevented: true } };
  }
  const adjustedAmount =
    status === "freeze" && state.talentEffects.receiveHalfFreezeBuildUp ? Math.round(amount / 2) : amount;
  const nextState = {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      ...(blockPreventsStatus ? {} : { [status]: state.playerStatuses[status] + adjustedAmount }),
    },
  };
  mergeCombatText(combatTexts, {
    target: CONSTANTS.TARGETS.PLAYER,
    kind: CONSTANTS.COMBAT_TEXT_KINDS.DAMAGE,
    stat: status,
    amount,
  });
  return nextState;
}

function applyBeneficialStatusFromAttack(
  state: BattleState,
  status: PlayerStatusId,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  mergeCombatText(combatTexts, {
    target: CONSTANTS.TARGETS.PLAYER,
    kind: CONSTANTS.COMBAT_TEXT_KINDS.STATUS,
    stat: status,
    amount,
  });
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      [status]: state.playerStatuses[status] + amount,
    },
  };
}

export function applyPlayerStatusFromAttack(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "player-status" },
  combatTexts: CombatTextEvent[],
): BattleState {
  const status = effect.status;
  let amount = computeAttackStatusAmount(state, status, effect.amount);
  if (status === CONSTANTS.STATUS_NAMES.STUN && state.talentEffects.armorMitigatesStun) {
    amount = Math.max(0, amount - state.playerStatuses.armor);
  }
  const blockPreventsStatus = shouldBlockPreventStatus(state, status);

  if (harmfulPlayerStatusIds.includes(status)) {
    return applyHarmfulStatusFromAttack(state, status, amount, blockPreventsStatus, combatTexts);
  }
  return applyBeneficialStatusFromAttack(state, status, amount, combatTexts);
}
