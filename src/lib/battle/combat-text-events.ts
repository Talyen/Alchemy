import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";

export function emitEnemyBuildupImmunity(
  state: BattleState,
  stat: "stun" | "freeze",
  amount: number,
  combatTexts: CombatTextEvent[],
): void {
  if (amount <= 0 || state.enemyHealth <= 0 || state.enemyCC.cooldown <= 0) return;
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "notice",
    stat,
    signal: "immune",
    text: `Immune to ${stat === "stun" ? "Stun" : "Freeze"}`,
  });
}

export function shouldShowCombatText(event: CombatTextEvent) {
  return (
    event.kind !== "status" || !harmfulPlayerStatusIds.includes(event.stat as (typeof harmfulPlayerStatusIds)[number])
  );
}

export function mergeCombatText(combatTexts: CombatTextEvent[], nextEvent: CombatTextEvent) {
  if (!shouldShowCombatText(nextEvent)) return;

  const existing = combatTexts.find((event) => {
    if (
      event.target !== nextEvent.target ||
      event.stat !== nextEvent.stat ||
      event.kind !== nextEvent.kind ||
      event.feedback !== nextEvent.feedback
    )
      return false;
    if (event.kind === "notice" && nextEvent.kind === "notice")
      return event.text === nextEvent.text && event.signal === nextEvent.signal;
    return (
      event.kind !== "notice" &&
      nextEvent.kind !== "notice" &&
      event.reactionId === nextEvent.reactionId &&
      event.impact === nextEvent.impact &&
      !!event.periodic === !!nextEvent.periodic &&
      event.additive !== false &&
      nextEvent.additive !== false &&
      Math.sign(event.amount) === Math.sign(nextEvent.amount)
    );
  });
  if (!existing) combatTexts.push(nextEvent);
  else if (existing.kind !== "notice" && nextEvent.kind !== "notice") {
    const previousAmount = existing.amount;
    existing.amount += nextEvent.amount;
    if (existing.healthLost !== undefined || nextEvent.healthLost !== undefined)
      existing.healthLost = (existing.healthLost ?? previousAmount) + (nextEvent.healthLost ?? nextEvent.amount);
    if (existing.absorbedDamage !== undefined || nextEvent.absorbedDamage !== undefined)
      existing.absorbedDamage =
        (existing.absorbedDamage ?? previousAmount) + (nextEvent.absorbedDamage ?? nextEvent.amount);
    if (nextEvent.critical) existing.critical = true;
    if (nextEvent.periodic) existing.periodic = true;
  }
}
