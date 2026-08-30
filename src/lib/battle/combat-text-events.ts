import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleState, CombatTextEvent, NumericCombatTextEvent } from "./types";

function isNoticeCombatText(event: CombatTextEvent) {
  return event.kind === "notice";
}

function isNumericCombatText(event: CombatTextEvent): event is NumericCombatTextEvent {
  return event.kind !== "notice";
}

export function shouldShowCombatText(event: CombatTextEvent) {
  return event.kind !== "status" || !harmfulPlayerStatusIds.includes(event.stat as never);
}

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
