import { rollBattleChance } from "./chance-roll";
import { readCombatFlag } from "./action-context";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleCardEffect, DamageType, EnemyAttackEffect, PlayerStatusId } from "@/lib/game-data";
import {
  addPlayerStatus,
  effectivePlayerHealingAmount,
  isPlayerDefeated,
  setPlayerStatus,
  stripEnemyArmor,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import {
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  applyArmorReward,
  applyArmorStatusEffect,
  applyBlockReward,
  removeHarmfulPlayerStatuses,
} from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import { BLEED_STATUS_MULTIPLIER, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";
import { paceCombatMagnitude } from "./fight-pacing";
import { dealScaledBurnWithStacks } from "./scaled-damage";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { applyPercentBonus, crossesGainThreshold } from "./amount-helpers";
import { clamp } from "@/lib/math";

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

export function applyBlockDepletionForgeReward(
  previousState: BattleState,
  nextState: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (
    previousState.playerStatuses.block <= 0 ||
    nextState.playerStatuses.block > 0 ||
    previousState.talentEffects.forgeOnBlockDepleted <= 0
  ) {
    return nextState;
  }
  return addForgeToPlayer(nextState, previousState.talentEffects.forgeOnBlockDepleted, combatTexts);
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

export function addForgeToPlayer(
  state: BattleState,
  baseAmount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  if (baseAmount <= 0) return state;
  let amount = baseAmount + state.talentEffects.flatForgeGained;
  if (state.playerStatuses.burn > 0 && state.talentEffects.forgeBurningBonusPercent > 0) {
    amount = applyPercentBonus(amount, state.talentEffects.forgeBurningBonusPercent);
  }
  if (rollBattleChance(state.talentEffects.forgeDoubleChance, state)) {
    amount *= 2;
  }
  if (state.playerHealth < state.playerMaxHealth / HALF_DIVISOR) {
    amount = applyPercentBonus(amount, state.talentEffects.forgeLowHealthBonusPercent);
  }
  if (!options?.skipFightPacing) amount = paceCombatMagnitude(state, amount, "player");
  if (amount <= 0) return state;
  const oldForge = state.playerStatuses.forge;
  const newForge = oldForge + amount;
  let nextState = addPlayerStatus(state, "forge", amount);
  nextState = applyForgeThresholdRewards(nextState, oldForge, newForge, combatTexts);
  if (combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "forge",
      amount,
    });
  }
  return nextState;
}

/** Only attack spending is eligible for Patient Edge recovery. */
export function spendPlayerForgeForAttack(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const spent = clamp(amount, 0, state.playerStatuses.forge);
  if (spent <= 0) return state;
  let next = setPlayerStatus(state, "forge", state.playerStatuses.forge - spent);
  if (state.gearEffects.recoverSpentForge > 0) {
    next = { ...next, uniqueGear: { ...next.uniqueGear, spentForge: next.uniqueGear.spentForge + spent } };
  }
  return next.playerStatuses.forge === 0 && state.gearEffects.blockOnLastForgeSpent > 0
    ? applyBlockReward(next, state.gearEffects.blockOnLastForgeSpent, combatTexts)
    : next;
}

/** Restore after the turn reset so threshold rewards belong to the new turn. */
export function restoreSpentPlayerForge(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  const amount = state.uniqueGear.spentForge;
  if (amount <= 0) return state;
  const cleared = { ...state, uniqueGear: { ...state.uniqueGear, spentForge: 0 } };
  if (state.gearEffects.recoverSpentForge <= 0) return cleared;
  const previousForge = state.playerStatuses.forge;
  const restored = addPlayerStatusWithCombatText(cleared, "forge", amount, combatTexts, { skipFightPacing: true });
  return applyForgeThresholdRewards(restored, previousForge, restored.playerStatuses.forge, combatTexts);
}

export function applyForgeThresholdRewards(
  state: BattleState,
  oldForge: number,
  newForge: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  const { forgeBurnThreshold, forgeStripArmorThreshold, forgeBlockThreshold } = state.talentEffects;
  let nextState = state;
  // Burn resolves before stripping Armor and granting Block, including any
  // Forge earned by the Burn itself. Thresholds use this gain's original span.
  if (crossesGainThreshold(oldForge, newForge, forgeBurnThreshold) && nextState.enemyHealth > 0) {
    const burned = dealScaledBurnWithStacks(nextState, nextState.talentEffects.forgeBurnDamage, combatTexts ?? [], {
      multiplier: getEnemyDamageMultiplier(nextState, "burn"),
    });
    nextState =
      nextState.enemyStatuses.burn === 0 &&
      burned.enemyHealth < nextState.enemyHealth &&
      burned.gearEffects.forgeOnBurnVsUnburned > 0
        ? addForgeToPlayer(burned, burned.gearEffects.forgeOnBurnVsUnburned, combatTexts)
        : burned;
  }
  if (crossesGainThreshold(oldForge, newForge, forgeStripArmorThreshold)) nextState = stripEnemyArmor(nextState);
  if (crossesGainThreshold(oldForge, newForge, forgeBlockThreshold))
    nextState = applyBlockReward(nextState, nextState.talentEffects.forgeBlockAmount, combatTexts ?? []);
  return nextState;
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
  if (harmfulPlayerStatusIds.includes(status)) {
    if (shouldBlockPreventStatusBuildup(state, status)) return state;
    return addPlayerStatusWithCombatText(state, status, scaleBleedStatus(status, amount), combatTexts, {
      skipFightPacing: true,
    });
  }
  if (status === "block") {
    return applyBlockReward(state, amount, combatTexts, { skipFightPacing: true });
  }
  return addPlayerStatusWithCombatText(state, status, amount, combatTexts, { skipFightPacing: true });
}

export {
  applyArmorReward,
  applyBlockReward,
  applyCleanseHeals,
  applyIronGuardReward,
  removeHarmfulPlayerStatuses,
} from "./player-rewards";
