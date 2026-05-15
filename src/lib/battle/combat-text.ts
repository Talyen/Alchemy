// Combat text aggregation helpers shared by battle effect modules.
// Keeps presentation event merging independent from any specific effect reducer.
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
