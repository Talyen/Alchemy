import { rollBattleChance } from "./chance-roll";
import { readCombatFlag } from "./action-context";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleCardEffect, DamageType, EnemyAttackEffect, PlayerStatusId } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { addPlayerStatus } from "./status-state";
import { effectivePlayerHealingAmount, isPlayerDefeated } from "./health-state";
import {
  addForgeToPlayer,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  applyArmorReward,
  applyArmorStatusEffect,
  applyBlockReward,
  removeHarmfulPlayerStatuses,
  rollForgeAffixAwards,
} from "./player-rewards";
import { BLEED_STATUS_MULTIPLIER, PERCENT_DENOMINATOR } from "../game-constants";
import { paceCombatMagnitude } from "./fight-pacing";

export { rollForgeAffixAwards, addForgeToPlayer };

export function applyCardHealing(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options?: { skipFightPacing?: boolean; allowOverhealBlock?: boolean },
): BattleState {
  const paced = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
  const overheals =
    effectivePlayerHealingAmount(state, paced) > Math.max(0, state.playerMaxHealth - state.playerHealth);
  const healed = applyHealingWithCombatText(state, paced, combatTexts, {
    skipFightPacing: true,
    allowOverhealBlock: options?.allowOverhealBlock ?? true,
  });
  return overheals && state.talentEffects.cleanseOnCardOverheal
    ? removeHarmfulPlayerStatuses(healed, 1, combatTexts)
    : healed;
}

export function countRemovableHarmfulStatuses(playerStatuses: BattleState["playerStatuses"]): number {
  let count = 0;
  for (const statusId of harmfulPlayerStatusIds) {
    if (playerStatuses[statusId] > 0) count += 1;
  }
  return count;
}

export function applyHealthLossTalentRewards(
  previousState: BattleState,
  nextState: BattleState,
  healthLost: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (
    healthLost <= 0 ||
    isPlayerDefeated(nextState) ||
    !rollBattleChance(previousState.talentEffects.healthLossCleanseChance, previousState)
  ) {
    return nextState;
  }
  return removeHarmfulPlayerStatuses(nextState, 1, combatTexts);
}

export function applyBlockDepletionRewards(
  previousState: BattleState,
  nextState: BattleState,
  combatTexts: CombatTextEvent[],
  depleted = previousState.playerStatuses.block > 0 && nextState.playerStatuses.block <= 0,
): BattleState {
  if (!depleted || isPlayerDefeated(nextState)) return nextState;
  const healing = previousState.talentEffects.blockDepletedHeal + previousState.gearEffects.blockDepletedHeal;
  const rewarded = healing > 0 ? applyHealingWithCombatText(nextState, healing, combatTexts) : nextState;

  return previousState.gearEffects.thornsOnBlockDepleted > 0
    ? addPlayerStatusWithCombatText(rewarded, "thorns", previousState.gearEffects.thornsOnBlockDepleted, combatTexts)
    : rewarded;
}

function crossedBelow(prevHealth: number, nextHealth: number, thresholdHp: number): boolean {
  return prevHealth >= thresholdHp && nextHealth < thresholdHp;
}

export function applyHealthThresholdCleanse(
  previousHealth: number,
  state: BattleState,
  combatTexts?: CombatTextEvent[],
  healthAfterDamage = state.playerHealth,
): BattleState {
  const threshold = (state.playerMaxHealth * state.talentEffects.cleanseBelowHealthPercent) / PERCENT_DENOMINATOR;
  return threshold > 0 && previousHealth >= threshold && healthAfterDamage < threshold && healthAfterDamage > 0
    ? removeHarmfulPlayerStatuses(state, Infinity, combatTexts)
    : state;
}

export function checkHealthThresholds(
  prevHealth: number,
  nextHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (nextHealth <= 0) return state;
  let nextState = applyHealthThresholdCleanse(prevHealth, state, combatTexts, nextHealth);
  const maxHealth = state.playerMaxHealth;
  const block = state.talentEffects.healthThresholdBlock;
  if (block && crossedBelow(prevHealth, nextHealth, (maxHealth * block.threshold) / PERCENT_DENOMINATOR))
    nextState = applyBlockReward(nextState, block.amount, combatTexts);
  const once = state.talentEffects.healthThresholdBlockOnce;
  if (once && !readCombatFlag(nextState, "desperateGuardUsed")) {
    const thresholdHp = (maxHealth * once.threshold) / PERCENT_DENOMINATOR;
    if (crossedBelow(prevHealth, nextHealth, thresholdHp)) {
      nextState = applyBlockReward(nextState, once.amount, combatTexts);
      nextState = { ...nextState, flags: { ...nextState.flags, desperateGuardUsed: true } };
    }
  }
  for (const config of state.talentEffects.healthThresholdArmor) {
    const thresholdHp = (maxHealth * config.threshold) / PERCENT_DENOMINATOR;
    if (!crossedBelow(prevHealth, nextHealth, thresholdHp)) continue;
    nextState = applyArmorReward(nextState, config.amount, combatTexts);
  }
  return nextState;
}

function scaleBleedStatus(status: PlayerStatusId, amount: number): number {
  return status === "bleed" ? amount * BLEED_STATUS_MULTIPLIER : amount;
}

export function applyPlayerStatusEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  combatTexts: CombatTextEvent[],
) {
  if (effect.status === "armor") return applyArmorStatusEffect(state, effect.amount, combatTexts);
  if (effect.status === "forge") {
    return addForgeToPlayer(state, effect.amount, combatTexts);
  }
  if (effect.status === "block") {
    return applyBlockReward(state, effect.amount, combatTexts);
  }
  return addPlayerStatusWithCombatText(state, effect.status, effect.amount, combatTexts, { skipFightPacing: true });
}

const BLOCK_PREVENTED_STATUSES: Partial<
  Record<DamageType | PlayerStatusId, "blockPreventsStun" | "blockPreventsBleed" | "blockPreventsPoison">
> = {
  stun: "blockPreventsStun",
  bleed: "blockPreventsBleed",
  poison: "blockPreventsPoison",
};

export function shouldBlockPreventStatusBuildup(state: BattleState, status: DamageType | PlayerStatusId): boolean {
  if (state.playerStatuses.block <= 0) return false;
  const flag = BLOCK_PREVENTED_STATUSES[status];
  return flag ? state.talentEffects[flag] : false;
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
  applyBlockReward,
  applyCleanseHeals,
  applyIronGuardReward,
  removeHarmfulPlayerStatuses,
} from "./player-rewards";
