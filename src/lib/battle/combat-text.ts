/**
 * Aggregates and merges floating combat text events for UI rendering.
 * Depends on: types.ts.
 * Depended on by: apply-effects, card-play, damage, status-effects, enemy-turn, trinket-effects, wish.
 */
import type { BattleState, CombatTextEvent, NumericCombatTextEvent } from "./types";

const hiddenStatusApplicationStats = new Set(["burn", "poison", "bleed", "freeze", "stun"]);

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
  return event.kind !== "status" || !hiddenStatusApplicationStats.has(event.stat);
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
