import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleCardEffect, DamageType, EnemyAttackEffect, PlayerStatusId } from "@/lib/game-data";
import {
  addEnemyStatus,
  addPlayerStatus,
  playerStatusDelta,
  setFlag,
  stripEnemyArmor,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { addPlayerStatusWithCombatText, applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { BLEED_STATUS_MULTIPLIER, FIRST_EFFECT_MULTIPLIER, HALF_DIVISOR } from "../game-constants";
import { paceCombatMagnitude } from "./fight-pacing";

export function countRemovableHarmfulStatuses(playerStatuses: BattleState["playerStatuses"]): number {
  return harmfulPlayerStatusIds.filter((statusId) => playerStatuses[statusId] > 0).length;
}

function clearHarmfulStatuses(playerStatuses: BattleState["playerStatuses"], statusTypesToClear: number) {
  const nextPlayerStatuses = { ...playerStatuses };
  let removed = 0;
  const limit = Number.isFinite(statusTypesToClear) ? statusTypesToClear : harmfulPlayerStatusIds.length;
  for (const statusId of harmfulPlayerStatusIds) {
    if (removed >= limit) break;
    if (nextPlayerStatuses[statusId] <= 0) continue;
    nextPlayerStatuses[statusId] = 0;
    removed++;
  }
  return { nextPlayerStatuses, removed };
}

export function applyCleanseHeals(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  const nextState = applyHealingWithCombatText(
    state,
    state.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
    combatTexts,
  );
  return applyHealingWithCombatText(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);
}

export function removeHarmfulPlayerStatuses(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]) {
  const { nextPlayerStatuses, removed } = clearHarmfulStatuses(state.playerStatuses, amount);
  let nextState = { ...state, playerStatuses: nextPlayerStatuses };
  if (removed) {
    nextState = applyCleanseHeals(nextState, combatTexts);
  }
  return nextState;
}

function scaleArmorAmount(state: BattleState, amount: number): { state: BattleState; amount: number } {
  let nextAmount = amount;
  let nextState = state;
  if (
    nextState.talentEffects.armorDoubledBelowHalfHealth &&
    nextState.playerHealth <= nextState.playerMaxHealth / HALF_DIVISOR
  ) {
    nextAmount *= FIRST_EFFECT_MULTIPLIER;
  }
  if (nextState.talentEffects.firstArmorCardDoubled && !nextState.flags.firstArmorCardDoubledUsed) {
    nextAmount *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstArmorCardDoubledUsed", true);
  }
  return { state: nextState, amount: nextAmount };
}

function procArmorBlockThreshold(state: BattleState, newArmor: number, combatTexts: CombatTextEvent[]) {
  if (
    state.talentEffects.armorBlockThreshold <= 0 ||
    state.playerStatuses.armor >= state.talentEffects.armorBlockThreshold ||
    newArmor < state.talentEffects.armorBlockThreshold
  ) {
    return state;
  }
  return addPlayerStatusWithCombatText(state, "block", state.talentEffects.armorBlockAmount, combatTexts);
}

function procArmorCleanseThreshold(state: BattleState, newArmor: number, combatTexts: CombatTextEvent[]) {
  if (
    state.talentEffects.armorCleanseThreshold <= 0 ||
    state.playerStatuses.armor >= state.talentEffects.armorCleanseThreshold ||
    newArmor < state.talentEffects.armorCleanseThreshold
  ) {
    return state;
  }
  return removeHarmfulPlayerStatuses(state, Number.POSITIVE_INFINITY, combatTexts);
}

function applyArmorTalentChecks(state: BattleState, amount: number, combatTexts: CombatTextEvent[]) {
  const scaled = scaleArmorAmount(state, amount);
  const newArmor = scaled.state.playerStatuses.armor + scaled.amount;
  const withBlock = procArmorBlockThreshold(scaled.state, newArmor, combatTexts);
  const withCleanse = procArmorCleanseThreshold(withBlock, newArmor, combatTexts);
  return { state: withCleanse, amount: scaled.amount };
}

function onForgeFirstCrossThreshold(
  state: BattleState,
  prevForge: number,
  nextForge: number,
  threshold: number,
  onCross: (s: BattleState) => BattleState,
): BattleState {
  if (threshold <= 0 || prevForge >= threshold || nextForge < threshold) return state;
  return onCross(state);
}

function applyForgeBurnBurst(state: BattleState, oldForge: number, newForge: number, combatTexts?: CombatTextEvent[]) {
  return onForgeFirstCrossThreshold(state, oldForge, newForge, state.talentEffects.forgeBurnThreshold, (s) => {
    const burnAmount = s.talentEffects.forgeBurnDamage;
    const nextState = addEnemyStatus(s, "burn", burnAmount);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "status",
        stat: "burn",
        amount: burnAmount,
      });
    }
    return nextState;
  });
}

function applyForgeStripArmorBurst(state: BattleState, oldForge: number, newForge: number): BattleState {
  return onForgeFirstCrossThreshold(
    state,
    oldForge,
    newForge,
    state.talentEffects.forgeStripArmorThreshold,
    stripEnemyArmor,
  );
}

function applyForgeBlockBurst(
  state: BattleState,
  oldForge: number,
  newForge: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  return onForgeFirstCrossThreshold(state, oldForge, newForge, state.talentEffects.forgeBlockThreshold, (s) => {
    let amount = s.talentEffects.forgeBlockAmount;
    if (s.talentEffects.forgeToBlock) {
      amount += newForge;
    }
    amount = paceCombatMagnitude(s, amount, "player");
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "block",
        amount,
      });
    }
    return addPlayerStatus(s, "block", amount);
  });
}

export function addForgeToPlayer(state: BattleState, baseAmount: number, combatTexts?: CombatTextEvent[]): BattleState {
  let amount = baseAmount + state.talentEffects.flatForgeGained;
  if (state.talentEffects.forgeDoubledBelowHalfHealth && state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR) {
    amount *= 2;
  }
  if (amount <= 0) return state;
  const oldForge = state.playerStatuses.forge;
  const newForge = oldForge + amount;
  let nextState = addPlayerStatus(state, "forge", amount);
  nextState = applyForgeBurnBurst(nextState, oldForge, newForge, combatTexts);
  nextState = applyForgeStripArmorBurst(nextState, oldForge, newForge);
  nextState = applyForgeBlockBurst(nextState, oldForge, newForge, combatTexts);
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
  if (effect.status === "block" && state.talentEffects.forgeToBlock) {
    amount += state.playerStatuses.forge;
  }
  if (effect.status === "block") {
    amount = paceCombatMagnitude(state, amount, "player");
  }
  if (effect.status === "forge") {
    return addForgeToPlayer(state, amount, combatTexts);
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

export function shouldBlockPreventStunBuildup(state: BattleState): boolean {
  return state.talentEffects.blockPreventsStun && state.playerStatuses.block > 0;
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
    return {
      ...state,
      playerStatuses: {
        ...state.playerStatuses,
        [statusType]: state.playerStatuses[statusType] + adjustedDamage,
      },
    };
  }
  return state;
}

type DirectPlayerStatusId = Exclude<PlayerStatusId, "stun" | "freeze">;
export type DirectPlayerStatusAttackEffect = Extract<EnemyAttackEffect, { kind: "player-status" }> & {
  status: DirectPlayerStatusId;
};

function shouldBlockPreventStatus(state: BattleState, status: DirectPlayerStatusId) {
  if (state.playerStatuses.block <= 0) return false;
  if (status === "bleed" && state.talentEffects.blockPreventsBleed) return true;
  if (status === "poison" && state.talentEffects.blockPreventsPoison) return true;
  return false;
}

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

  if (state.trinketEffects.plagueDoctorImmunity && !state.flags.firstHarmfulStatusPrevented) {
    return { ...state, flags: { ...state.flags, firstHarmfulStatusPrevented: true } };
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
  const blockPreventsStatus = shouldBlockPreventStatus(state, status);

  if (harmfulPlayerStatusIds.includes(status)) {
    return applyHarmfulStatusFromAttack(state, status, amount, blockPreventsStatus, combatTexts);
  }
  return applyBeneficialStatusFromAttack(state, status, amount, combatTexts);
}
