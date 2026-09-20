import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleCardEffect, DamageType, EnemyAttackEffect, PlayerStatusId } from "@/lib/game-data";
import {
  addPlayerStatus,
  effectivePlayerHealingAmount,
  playerStatusDelta,
  setFlag,
  setPlayerStatus,
  stripEnemyArmor,
  withPreservedFlags,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { addPlayerStatusWithCombatText, applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { BLEED_STATUS_MULTIPLIER, FIRST_EFFECT_MULTIPLIER, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";
import { paceCombatMagnitude } from "./fight-pacing";
import { dealScaledBurnWithStacks } from "./scaled-damage";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { applyPercentBonus, scalePercent } from "./amount-helpers";
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

export function applyArmorReward(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  return withPreservedFlags(state, (current) =>
    applyPlayerStatusEffect(current, { kind: "player-status", status: "armor", amount }, combatTexts),
  );
}

function clearHarmfulStatuses(state: BattleState, statusTypesToClear: number) {
  let nextState = state;
  let removed = 0;
  const limit = Number.isFinite(statusTypesToClear) ? statusTypesToClear : harmfulPlayerStatusIds.length;
  for (const statusId of harmfulPlayerStatusIds) {
    if (removed >= limit) break;
    if (nextState.playerStatuses[statusId] <= 0) continue;
    nextState = setPlayerStatus(nextState, statusId, 0);
    removed++;
  }
  return { nextState, removed };
}

export function applyCleanseHeals(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  const nextState = applyHealingWithCombatText(
    state,
    state.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
    combatTexts,
  );
  const healed = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);
  return healed.talentEffects.nextHolyFreeOnCleanse ? setFlag(healed, "nextHolyCardFree", true) : healed;
}

export function removeHarmfulPlayerStatuses(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]) {
  const cleared = clearHarmfulStatuses(state, amount);
  let nextState = cleared.nextState;
  if (cleared.removed) {
    for (const stat of harmfulPlayerStatusIds) {
      if (state.playerStatuses[stat] > 0 && nextState.playerStatuses[stat] === 0 && combatTexts) {
        mergeCombatText(combatTexts, { target: "player", kind: "notice", stat, signal: "cleanse", text: "" });
      }
    }
    nextState = applyCleanseHeals(nextState, combatTexts);
  }
  return nextState;
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
      next = applyPlayerStatusEffect(next, { kind: "player-status", status: stat, amount: config.amount }, combatTexts);
    }
  }
  return next;
}

function scaleArmorAmount(state: BattleState, amount: number): { state: BattleState; amount: number } {
  let nextAmount = amount;
  let nextState = state;
  if (nextState.playerHealth < nextState.playerMaxHealth / HALF_DIVISOR) {
    nextAmount = nextState.talentEffects.armorDoubledBelowHalfHealth
      ? nextAmount * FIRST_EFFECT_MULTIPLIER
      : applyPercentBonus(nextAmount, nextState.talentEffects.armorLowHealthBonusPercent);
  }
  if (nextState.talentEffects.firstArmorCardDoubled && !nextState.flags.firstArmorCardDoubledUsed) {
    nextAmount *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstArmorCardDoubledUsed", true);
  }
  return { state: nextState, amount: nextAmount };
}

function onFirstCrossThreshold(
  prevValue: number,
  nextValue: number,
  threshold: number,
  onCross: (s: BattleState) => BattleState,
  state: BattleState,
): BattleState {
  if (threshold <= 0 || prevValue >= threshold || nextValue < threshold) return state;
  return onCross(state);
}

function procArmorBlockThreshold(state: BattleState, newArmor: number, combatTexts: CombatTextEvent[]) {
  return onFirstCrossThreshold(
    state.playerStatuses.armor,
    newArmor,
    state.talentEffects.armorBlockThreshold,
    (s) => addPlayerStatusWithCombatText(s, "block", s.talentEffects.armorBlockAmount, combatTexts),
    state,
  );
}

function procArmorCleanseThreshold(state: BattleState, newArmor: number, combatTexts: CombatTextEvent[]) {
  return onFirstCrossThreshold(
    state.playerStatuses.armor,
    newArmor,
    state.talentEffects.armorCleanseThreshold,
    (s) => removeHarmfulPlayerStatuses(s, Number.POSITIVE_INFINITY, combatTexts),
    state,
  );
}

function applyArmorTalentChecks(state: BattleState, amount: number, combatTexts: CombatTextEvent[]) {
  const scaled = scaleArmorAmount(state, amount);
  const newArmor = scaled.state.playerStatuses.armor + scaled.amount;
  const withBlock = procArmorBlockThreshold(scaled.state, newArmor, combatTexts);
  const withCleanse = procArmorCleanseThreshold(withBlock, newArmor, combatTexts);
  return { state: withCleanse, amount: scaled.amount };
}

function applyForgeBurnBurst(state: BattleState, oldForge: number, newForge: number, combatTexts?: CombatTextEvent[]) {
  return onFirstCrossThreshold(
    oldForge,
    newForge,
    state.talentEffects.forgeBurnThreshold,
    (s) => {
      if (s.enemyHealth <= 0) return s;
      return dealScaledBurnWithStacks(s, s.talentEffects.forgeBurnDamage, combatTexts ?? [], {
        multiplier: getEnemyDamageMultiplier(s, "burn"),
      });
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
    (s) => {
      let amount = s.talentEffects.forgeBlockAmount;
      amount += s.talentEffects.forgeToBlock ? newForge : scalePercent(newForge, s.talentEffects.forgeBlockPercent);
      amount = paceCombatMagnitude(s, amount, "player");
      return addPlayerStatusWithCombatText(s, "block", amount, combatTexts, { skipFightPacing: true });
    },
    state,
  );
}

export function addForgeToPlayer(state: BattleState, baseAmount: number, combatTexts?: CombatTextEvent[]): BattleState {
  let amount = baseAmount + state.talentEffects.flatForgeGained;
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
export function spendPlayerForgeForAttack(state: BattleState, amount: number): BattleState {
  const spent = clamp(amount, 0, state.playerStatuses.forge);
  if (spent <= 0) return state;
  const next = setPlayerStatus(state, "forge", state.playerStatuses.forge - spent);
  return state.gearEffects.recoverSpentForge > 0
    ? { ...next, uniqueGear: { ...next.uniqueGear, spentForge: next.uniqueGear.spentForge + spent } }
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
  let amount = effect.amount;
  if (effect.status === "armor") {
    amount += state.talentEffects.flatArmorAmount;
    const checked = applyArmorTalentChecks(state, amount, combatTexts);
    state = checked.state;
    amount = checked.amount;
  }
  if (effect.status === "block") {
    amount += state.talentEffects.forgeToBlock
      ? state.playerStatuses.forge
      : scalePercent(state.playerStatuses.forge, state.talentEffects.forgeBlockPercent);
  }
  if (effect.status === "block") {
    amount = paceCombatMagnitude(state, amount, "player");
  }
  if (effect.status === "forge") {
    return addForgeToPlayer(state, amount, combatTexts);
  }
  if (effect.status === "block") {
    return addPlayerStatusWithCombatText(state, "block", amount, combatTexts, { skipFightPacing: true });
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
    return addPlayerStatusWithCombatText(state, "block", amount, combatTexts, { skipFightPacing: true });
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
