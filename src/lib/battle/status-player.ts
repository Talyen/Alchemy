import { readCombatFlag } from "./action-context";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleCardEffect, DamageType, EnemyAttackEffect, PlayerStatusId } from "@/lib/game-data";
import {
  addPlayerStatus,
  effectivePlayerHealingAmount,
  isPlayerDefeated,
  playerStatusDelta,
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
  onFirstCrossThreshold,
} from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import { BLEED_STATUS_MULTIPLIER, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";
import { paceCombatMagnitude } from "./fight-pacing";
import { dealScaledBurnWithStacks } from "./scaled-damage";
import { getEnemyDamageMultiplier, rollTalentChance } from "./status-helpers";
import { applyPercentBonus } from "./amount-helpers";
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
  return harmfulPlayerStatusIds.filter((statusId) => playerStatuses[statusId] > 0).length;
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
    !rollTalentChance(previousState.talentEffects.healthLossCleanseChance, previousState)
  ) {
    return nextState;
  }
  return removeHarmfulPlayerStatuses(nextState, 1, combatTexts);
}

export function applyIronGuardReward(
  state: BattleState,
  damageType: DamageType,
  healthDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (
    damageType !== "physical" ||
    healthDamage <= 0 ||
    !rollTalentChance(state.talentEffects.armorOnPhysicalDamageChance, state)
  ) {
    return state;
  }
  return applyArmorReward(state, healthDamage, combatTexts);
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

export function applyHealthThresholdCleanse(
  previousHealth: number,
  state: BattleState,
  combatTexts?: CombatTextEvent[],
): BattleState {
  const threshold = (state.playerMaxHealth * state.talentEffects.cleanseBelowHealthPercent) / PERCENT_DENOMINATOR;
  return threshold > 0 && previousHealth >= threshold && state.playerHealth < threshold && state.playerHealth > 0
    ? removeHarmfulPlayerStatuses(state, Infinity, combatTexts)
    : state;
}

export function checkHealthThresholds(
  prevHealth: number,
  nextHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
) {
  if (nextHealth <= 0) return state;
  let nextState = state;

  nextState = applyHealthThresholdCleanse(prevHealth, nextState, combatTexts);
  nextState = applyHealthThresholdStatBonus(
    nextState,
    prevHealth,
    nextHealth,
    state.playerMaxHealth,
    state.talentEffects.healthThresholdBlock,
    "block",
    combatTexts,
  );
  nextState = applyOncePerCombatHealthThresholdBlock(
    nextState,
    prevHealth,
    nextHealth,
    state.playerMaxHealth,
    state.talentEffects.healthThresholdBlockOnce,
    combatTexts,
  );
  nextState = applyHealthThresholdStatBonus(
    nextState,
    prevHealth,
    nextHealth,
    state.playerMaxHealth,
    state.talentEffects.healthThresholdArmor,
    "armor",
    combatTexts,
  );
  return nextState;
}

function applyOncePerCombatHealthThresholdBlock(
  currentState: BattleState,
  prevHealth: number,
  nextHealth: number,
  playerMaxHealth: number,
  config: { threshold: number; amount: number } | null,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (!config || readCombatFlag(currentState, "desperateGuardUsed")) return currentState;
  const thresholdHp = (playerMaxHealth * config.threshold) / PERCENT_DENOMINATOR;
  if (prevHealth < thresholdHp || nextHealth >= thresholdHp) return currentState;
  const rewarded = applyBlockReward(currentState, config.amount, combatTexts);
  return { ...rewarded, flags: { ...rewarded.flags, desperateGuardUsed: true } };
}

function applyHealthThresholdStatBonus(
  currentState: BattleState,
  prevHealth: number,
  nextHealth: number,
  playerMaxHealth: number,
  configs: { threshold: number; amount: number } | Array<{ threshold: number; amount: number }> | null,
  stat: "block" | "armor",
  combatTexts: CombatTextEvent[],
): BattleState {
  const bonuses = configs == null ? [] : Array.isArray(configs) ? configs : [configs];
  let next = currentState;
  for (const config of bonuses) {
    const thresholdHp = (playerMaxHealth * config.threshold) / PERCENT_DENOMINATOR;
    if (prevHealth >= thresholdHp && nextHealth < thresholdHp) {
      next =
        stat === "armor"
          ? applyArmorReward(next, config.amount, combatTexts)
          : applyPlayerStatusEffect(next, { kind: "player-status", status: stat, amount: config.amount }, combatTexts);
    }
  }
  return next;
}

function applyForgeBurnBurst(state: BattleState, oldForge: number, newForge: number, combatTexts?: CombatTextEvent[]) {
  return onFirstCrossThreshold(
    oldForge,
    newForge,
    state.talentEffects.forgeBurnThreshold,
    (s) => {
      if (s.enemyHealth <= 0) return s;
      const burned = dealScaledBurnWithStacks(s, s.talentEffects.forgeBurnDamage, combatTexts ?? [], {
        multiplier: getEnemyDamageMultiplier(s, "burn"),
      });
      return s.enemyStatuses.burn === 0 &&
        burned.enemyHealth < s.enemyHealth &&
        burned.gearEffects.forgeOnBurnVsUnburned > 0
        ? addForgeToPlayer(burned, burned.gearEffects.forgeOnBurnVsUnburned, combatTexts)
        : burned;
    },
    state,
  );
}

function applyForgeStripArmorBurst(state: BattleState, oldForge: number, newForge: number): BattleState {
  return onFirstCrossThreshold(
    oldForge,
    newForge,
    state.talentEffects.forgeStripArmorThreshold,
    stripEnemyArmor,
    state,
  );
}

function applyForgeBlockBurst(
  state: BattleState,
  oldForge: number,
  newForge: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  return onFirstCrossThreshold(
    oldForge,
    newForge,
    state.talentEffects.forgeBlockThreshold,
    (s) => applyBlockReward(s, s.talentEffects.forgeBlockAmount, combatTexts ?? []),
    state,
  );
}

export function addForgeToPlayer(state: BattleState, baseAmount: number, combatTexts?: CombatTextEvent[]): BattleState {
  let amount = baseAmount + state.talentEffects.flatForgeGained;
  if (state.playerStatuses.burn > 0 && state.talentEffects.forgeBurningBonusPercent > 0) {
    amount = applyPercentBonus(amount, state.talentEffects.forgeBurningBonusPercent);
  }
  if (rollTalentChance(state.talentEffects.forgeDoubleChance, state)) {
    amount *= 2;
  }
  if (state.playerHealth < state.playerMaxHealth / HALF_DIVISOR) {
    amount = state.talentEffects.forgeDoubledBelowHalfHealth
      ? amount * 2
      : applyPercentBonus(amount, state.talentEffects.forgeLowHealthBonusPercent);
  }
  amount = paceCombatMagnitude(state, amount, "player");
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
  let nextState = applyForgeBurnBurst(state, oldForge, newForge, combatTexts);
  nextState = applyForgeStripArmorBurst(nextState, oldForge, newForge);
  return applyForgeBlockBurst(nextState, oldForge, newForge, combatTexts);
}

export function applyPlayerStatusEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  combatTexts: CombatTextEvent[],
) {
  const amount = effect.amount;
  if (effect.status === "armor") return applyArmorStatusEffect(state, amount, combatTexts);
  if (effect.status === "forge") {
    return addForgeToPlayer(state, amount, combatTexts);
  }
  if (effect.status === "block") {
    return applyBlockReward(state, amount, combatTexts);
  }
  const effectiveAmount = playerStatusDelta(state, effect.status, amount);
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: effect.status,
    amount: effectiveAmount,
  });
  return addPlayerStatus(state, effect.status, amount);
}

export function shouldBlockPreventStatusBuildup(state: BattleState, status: DamageType | PlayerStatusId): boolean {
  if (state.playerStatuses.block <= 0) return false;
  if (status === "stun") return state.talentEffects.blockPreventsStun;
  if (status === "bleed") return state.talentEffects.blockPreventsBleed;
  if (status === "poison") return state.talentEffects.blockPreventsPoison;
  return false;
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
    const adjustedDamage = statusType === "bleed" ? actualDamage * BLEED_STATUS_MULTIPLIER : actualDamage;
    return addPlayerStatus(state, statusType, adjustedDamage);
  }
  return state;
}

type DirectPlayerStatusId = Exclude<PlayerStatusId, "stun" | "freeze">;
export type DirectPlayerStatusAttackEffect = Extract<EnemyAttackEffect, { kind: "player-status" }> & {
  status: DirectPlayerStatusId;
};

function applyHarmfulStatusFromAttack(
  state: BattleState,
  status: DirectPlayerStatusId,
  amount: number,
  blockPreventsStatus: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (blockPreventsStatus) {
    return state;
  }

  const appliedAmount = status === "bleed" ? amount * BLEED_STATUS_MULTIPLIER : amount;
  const nextState = addPlayerStatus(state, status, appliedAmount);

  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: status,
    amount: appliedAmount,
  });
  return nextState;
}

function applyBeneficialStatusFromAttack(
  state: BattleState,
  status: DirectPlayerStatusId,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (status === "block") {
    return applyBlockReward(state, amount, combatTexts, { skipFightPacing: true });
  }
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: status,
    amount,
  });
  return addPlayerStatus(state, status, amount);
}

export function applyPlayerStatusFromAttack(
  state: BattleState,
  effect: DirectPlayerStatusAttackEffect,
  combatTexts: CombatTextEvent[],
): BattleState {
  const status = effect.status;
  const amount = effect.amount;
  const blockPreventsStatus = shouldBlockPreventStatusBuildup(state, status);

  if (harmfulPlayerStatusIds.includes(status)) {
    return applyHarmfulStatusFromAttack(state, status, amount, blockPreventsStatus, combatTexts);
  }
  return applyBeneficialStatusFromAttack(state, status, amount, combatTexts);
}

export { applyArmorReward, applyBlockReward, applyCleanseHeals, removeHarmfulPlayerStatuses } from "./player-rewards";
