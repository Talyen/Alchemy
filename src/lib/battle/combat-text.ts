// Combat text deduplication helper — merges text events by (target, kind, stat).
import type { CombatTextEvent } from "./types";

export function mergeCombatText(combatTexts: CombatTextEvent[], nextEvent: CombatTextEvent) {
  const existingEvent = combatTexts.find(
    (event) => event.target === nextEvent.target && event.kind === nextEvent.kind && event.stat === nextEvent.stat,
  );

  if (existingEvent) {
    existingEvent.amount += nextEvent.amount;
    return;
  }

  combatTexts.push(nextEvent);
}
