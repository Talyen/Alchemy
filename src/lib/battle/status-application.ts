// Enemy attack status application to the player (harmful stacks and rare beneficial buffs).
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { EnemyAttackEffect, PlayerStatusId } from "@/lib/game-data/types";
import { mergeCombatText } from "./combat-text";
import type { BattleState, CombatTextEvent } from "./types";

function computeAttackStatusAmount(state: BattleState, status: PlayerStatusId, baseAmount: number) {
  const extraFreeze = status === "freeze" ? state.enemyMitigation.freezeBonus : 0;
  return baseAmount + extraFreeze;
}

function shouldBlockPreventStatus(state: BattleState, status: PlayerStatusId) {
  if (state.playerStatuses.block <= 0) return false;
  if (status === "bleed" && state.talentEffects.blockPreventsBleed) return true;
  if (status === "poison" && state.talentEffects.blockPreventsPoison) return true;
  if (status === "stun" && state.talentEffects.blockPreventsStun) return true;
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
  const nextState = {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      ...(blockPreventsStatus ? {} : { [status]: state.playerStatuses[status] + amount }),
    },
  };
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: status, amount });
  return nextState;
}

function applyBeneficialStatusFromAttack(
  state: BattleState,
  status: PlayerStatusId,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: status, amount });
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
  const amount = computeAttackStatusAmount(state, status, effect.amount);
  const blockPreventsStatus = shouldBlockPreventStatus(state, status);

  if (harmfulPlayerStatusIds.includes(status)) {
    return applyHarmfulStatusFromAttack(state, status, amount, blockPreventsStatus, combatTexts);
  }
  return applyBeneficialStatusFromAttack(state, status, amount, combatTexts);
}
