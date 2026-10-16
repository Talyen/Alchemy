import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { DamageType, EnemyAttackEffect, PlayerStatusId } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { addPlayerStatus } from "./status-state";
import { addPlayerStatusWithCombatText, applyBlockReward, rollForgeAffixAwards } from "./player-rewards";
import { BLEED_STATUS_MULTIPLIER } from "../game-constants";

export { rollForgeAffixAwards };

export function countRemovableHarmfulStatuses(playerStatuses: BattleState["playerStatuses"]): number {
  let count = 0;
  for (const statusId of harmfulPlayerStatusIds) {
    if (playerStatuses[statusId] > 0) count += 1;
  }
  return count;
}

function scaleBleedStatus(status: PlayerStatusId, amount: number): number {
  return status === "bleed" ? amount * BLEED_STATUS_MULTIPLIER : amount;
}

export function shouldBlockPreventStatusBuildup(state: BattleState, status: DamageType | PlayerStatusId): boolean {
  return status === "stun" && state.playerStatuses.block > 0 && state.talentEffects.blockPreventsStun;
}

export function applyPlayerDamageStatuses(
  state: BattleState,
  effect: { damageType: DamageType },
  actualDamage: number,
): BattleState {
  if (actualDamage <= 0) return state;
  const statusType = effect.damageType;
  if (
    statusType === "burn" ||
    statusType === "poison" ||
    statusType === "bleed" ||
    statusType === "freeze" ||
    statusType === "stun"
  ) {
    return addPlayerStatus(state, statusType, scaleBleedStatus(statusType, actualDamage));
  }
  return state;
}

type DirectPlayerStatusId = Exclude<PlayerStatusId, "stun" | "freeze">;
export type DirectPlayerStatusAttackEffect = Extract<EnemyAttackEffect, { kind: "player-status" }> & {
  status: DirectPlayerStatusId;
};

export function applyPlayerStatusFromAttack(
  state: BattleState,
  effect: DirectPlayerStatusAttackEffect,
  combatTexts: CombatTextEvent[],
): BattleState {
  const status = effect.status;
  const amount = effect.amount;
  const harmful = harmfulPlayerStatusIds.includes(status);
  if (harmful && shouldBlockPreventStatusBuildup(state, status)) return state;
  if (status === "block") return applyBlockReward(state, amount, combatTexts, { skipFightPacing: true });
  return addPlayerStatusWithCombatText(
    state,
    status,
    harmful ? scaleBleedStatus(status, amount) : amount,
    combatTexts,
    {
      skipFightPacing: true,
    },
  );
}

export {
  applyArmorReward,
  addForgeToPlayer,
  applyCardHealing,
  applyBlockDepletionRewards,
  applyHealthThresholdCleanse,
  checkHealthThresholds,
  applyPlayerStatusEffect,
  applyBlockReward,
  applyCleanseHeals,
  applyIronGuardReward,
  removeHarmfulPlayerStatuses,
} from "./player-rewards";
