import type { PlayerStatusId } from "@/lib/game-data";
import {
  addPlayerStatus,
  applyPlayerHealing,
  clampHealth,
  gainMana,
  scaleGoldReward,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { paceCombatMagnitude } from "./fight-pacing";
import { hasEnemyTrait } from "./enemy-trait-query";
import { payKillPayouts } from "./kill-payouts";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text-events";

export { emitOverhealBlockText, mergeCombatText, shouldShowCombatText } from "./combat-text-events";

function applyBloodCountessHealingReaction(
  state: BattleState,
  restoredHealth: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (restoredHealth <= 0 || state.enemyHealth <= 0 || !hasEnemyTrait(state, "blood-countess")) return state;
  const enemyWasAlive = state.enemyHealth > 0;
  const holyDamage = 1;
  if (combatTexts) mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "holy", amount: holyDamage });
  const damagedState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -holyDamage, state.enemyMaxHealth),
  };
  return payKillPayouts(damagedState, enemyWasAlive, combatTexts ?? []);
}

export function applyHealingWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  if (amount <= 0) return state;
  const healAmount = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
  const prevState = state;
  const nextState = applyPlayerHealing(state, healAmount);
  const actualHeal = nextState.playerHealth - prevState.playerHealth;
  if (combatTexts) {
    if (actualHeal > 0) {
      mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: actualHeal });
    }
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  return applyBloodCountessHealingReaction(nextState, actualHeal, combatTexts);
}

export function applyEnemyHealingWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  if (amount <= 0 || state.enemyHealth <= 0) return state;
  const healAmount = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "enemy");
  const nextHealth = clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth);
  const actualHeal = nextHealth - state.enemyHealth;
  if (actualHeal <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: actualHeal });
  return applyBloodCountessHealingReaction({ ...state, enemyHealth: nextHealth }, actualHeal, combatTexts);
}

export function applyHealOnManaGain(
  state: BattleState,
  gainAmount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.talentEffects.healOnManaGain <= 0 || gainAmount <= 0) return state;
  return applyHealingWithCombatText(state, state.talentEffects.healOnManaGain, combatTexts);
}

export function gainManaWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
  options?: { skipFightPacing?: boolean },
): BattleState {
  if (amount <= 0) return state;
  const granted = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
  const nextState = gainMana(state, granted);
  const gained = nextState.mana - state.mana;
  if (gained > 0 && combatTexts) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: gained });
  }
  return nextState;
}

export function addPlayerStatusWithCombatText(
  state: BattleState,
  stat: PlayerStatusId,
  amount: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (amount <= 0) return state;
  const before = state.playerStatuses[stat];
  const nextState = addPlayerStatus(state, stat, paceCombatMagnitude(state, amount, "player"));
  const delta = nextState.playerStatuses[stat] - before;
  if (delta > 0 && combatTexts) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat, amount: delta });
  }
  return nextState;
}

export function addGoldWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (amount <= 0) return state;

  const scaledGold = scaleGoldReward(amount, state.gearEffects);
  const nextState = { ...state, gold: state.gold + scaledGold };
  if (combatTexts && scaledGold > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "gold",
      amount: scaledGold,
    });
  }
  return nextState;
}
