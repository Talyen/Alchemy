/**
 * Aggregates and merges floating combat text events for UI rendering.
 * Depends on: types.ts.
 * Depended on by: effect-handlers, card-play, damage, status-player, status-cc,
 * status-stun-resolve, damage-status-riders, status-ticks, enemy-turn, trinket-effects, wish.
 */
import { harmfulPlayerStatusIds, type PlayerStatusId } from "@/lib/game-data";
import {
  addPlayerStatus,
  applyPlayerHealing,
  gainMana,
  scaleGoldReward,
  type BattleState,
  type CombatTextEvent,
  type NumericCombatTextEvent,
} from "./types";
import { paceCombatMagnitude } from "./fight-pacing";

// Narrows label-style combat text so numeric merging never assumes an amount exists.
function isNoticeCombatText(event: CombatTextEvent) {
  return event.kind === "notice";
}

// Narrows amount-bearing combat text so numeric events can merge safely.
function isNumericCombatText(event: CombatTextEvent): event is NumericCombatTextEvent {
  return event.kind !== "notice";
}

// Keeps harmful status applications out of floating numeric text while preserving
// actual DoT damage events, which use kind="damage" and should still show as -N.
export function shouldShowCombatText(event: CombatTextEvent) {
  return event.kind !== "status" || !harmfulPlayerStatusIds.includes(event.stat as never);
}

// Centralizes combat text filtering and merging so effect reducers can report resolved
// state changes without each call site deciding what belongs in floating number UI.
export function mergeCombatText(combatTexts: CombatTextEvent[], nextEvent: CombatTextEvent) {
  if (!shouldShowCombatText(nextEvent)) return;

  if (isNoticeCombatText(nextEvent)) {
    const existingNotice = combatTexts.find(
      (event) =>
        isNoticeCombatText(event) &&
        event.target === nextEvent.target &&
        event.stat === nextEvent.stat &&
        event.text === nextEvent.text,
    );
    if (!existingNotice) combatTexts.push(nextEvent);
    return;
  }

  const existingEvent = combatTexts.find(
    (event): event is NumericCombatTextEvent =>
      isNumericCombatText(event) &&
      event.target === nextEvent.target &&
      event.kind === nextEvent.kind &&
      event.stat === nextEvent.stat,
  );
  if (existingEvent) {
    existingEvent.amount += nextEvent.amount;
    return;
  }
  combatTexts.push(nextEvent);
}

// Helper for overheal-to-block talent. Emits block combat text when applyPlayerHealing
// triggers overheal conversion (talentEffect.overhealToBlockRatio).
export function emitOverhealBlockText(
  stateBefore: Pick<BattleState, "playerStatuses">,
  stateAfter: Pick<BattleState, "playerStatuses">,
  combatTexts: CombatTextEvent[],
) {
  if (stateAfter.playerStatuses.block <= stateBefore.playerStatuses.block) return;
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "block",
    amount: stateAfter.playerStatuses.block - stateBefore.playerStatuses.block,
  });
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
  if (combatTexts) {
    const actualHeal = nextState.playerHealth - prevState.playerHealth;
    if (actualHeal > 0) {
      mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: actualHeal });
    }
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  return nextState;
}

export function applyHealOnManaGain(
  state: BattleState,
  gainAmount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.talentEffects.healOnManaGain <= 0 || gainAmount <= 0) return state;
  return applyHealingWithCombatText(state, state.talentEffects.healOnManaGain, combatTexts);
}

// Paces the mana amount, applies it capped at maxMana, and reports the applied
// gain (never the authored amount) as floating text.
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

// Paces the status amount and reports the applied delta as floating text so
// clamped applications never display more than actually landed.
export function addPlayerStatusWithCombatText(
  state: BattleState,
  stat: PlayerStatusId,
  amount: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (amount <= 0) return state;
  const before = state.playerStatuses[stat];
  const nextState = addPlayerStatus(state, stat, paceCombatMagnitude(state, amount, "player"));
  if (combatTexts) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat,
      amount: nextState.playerStatuses[stat] - before,
    });
  }
  return nextState;
}

export function addGoldWithCombatText(
  state: BattleState,
  amount: number,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (amount <= 0) return state;
  // Scales once here so displayed and applied gold can never diverge.
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
