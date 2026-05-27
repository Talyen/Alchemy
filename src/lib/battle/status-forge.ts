/**
 * Forge threshold bursts and player forge application.
 * Depends on: ./types, ./combat-text, ./status-helpers, ../game-constants.
 */
import {
  addEnemyStatus,
  addPlayerStatus,
  isNullFieldActive,
  stripEnemyArmor,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { mergeCombatText } from "./combat-text";
import { HALF_DIVISOR, STATUS_CONFIG } from "../game-constants";

function computeForgeBurnAmount(state: BattleState): number {
  if (isNullFieldActive(state)) {
    return Math.max(STATUS_CONFIG.MIN_STACK_AMOUNT, Math.round(state.talentEffects.forgeBurnDamage / HALF_DIVISOR));
  }
  return state.talentEffects.forgeBurnDamage;
}

/** Fires `onCross` once when forge crosses `threshold` from below. */
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
    const burnAmount = computeForgeBurnAmount(s);
    const nextState = addEnemyStatus(s, "burn", burnAmount);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "damage",
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

export function applyStunForgeTalent(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  if (state.talentEffects.forgeOnStun <= 0) return state;
  return addForgeToPlayer(state, state.talentEffects.forgeOnStun, combatTexts);
}
