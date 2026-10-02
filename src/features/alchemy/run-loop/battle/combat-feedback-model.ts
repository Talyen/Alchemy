import { mergeCombatText, type CombatTextEvent } from "@/lib/battle";
import type { CombatImpactCue, CombatTextBurst } from "../../shared/types";
import { getCombatImpactVisual } from "../../shared/utils";
import { combatTextDisplay } from "./combat-feedback-merge";

/** Converts a resolved action without mutating events or reading runtime state. */
export function prepareCombatFeedback(
  events: readonly CombatTextEvent[],
  actionId: number,
  now: number,
  lifetimeMs: number,
) {
  const consolidated: CombatTextEvent[] = [];
  // Resolved frames can be saved and replayed; presentation must never mutate their events.
  for (const event of events) mergeCombatText(consolidated, { ...event });
  const priority = (event: CombatTextEvent) => (event.kind === "notice" ? 0 : event.kind === "damage" ? 1 : 2);
  consolidated.sort((a, b) => priority(a) - priority(b));
  const byTarget: Record<CombatTextEvent["target"], CombatTextEvent[]> = { player: [], enemy: [] };
  let hasMeaningful = false;
  for (const event of consolidated) {
    if (event.kind !== "notice" && event.amount === 0) continue;
    byTarget[event.target].push(event);
    hasMeaningful = true;
  }
  const fallback = consolidated[0];
  if (!hasMeaningful && fallback) byTarget[fallback.target].push(fallback);
  const bursts: CombatTextBurst[] = [];
  const impacts: Partial<Record<"playerImpactCue" | "enemyImpactCue", Omit<CombatImpactCue, "sequence">>> = {};
  for (const target of ["player", "enemy"] as const) {
    const entries = byTarget[target];
    if (entries.length === 0) continue;
    const id = `combat-burst-${actionId}-${target}`;
    bursts.push({
      id,
      target,
      firstShownAt: now,
      lifetimeMs,
      entries: entries.map((event, index) => ({
        ...event,
        id: `${id}-${index}`,
        displayText: combatTextDisplay(event),
        ...(event.kind !== "notice" ? { reservedDigits: String(Math.abs(event.amount)).length + 1 } : {}),
      })),
    });
    let strongest: { amount: number; visual: NonNullable<ReturnType<typeof getCombatImpactVisual>> } | undefined;
    for (const entry of entries) {
      const visual = getCombatImpactVisual(entry);
      if (!visual || entry.kind !== "damage") continue;
      if (
        !strongest ||
        (visual.healthLost && !strongest.visual.healthLost) ||
        (visual.healthLost === strongest.visual.healthLost && entry.amount > strongest.amount)
      ) {
        strongest = { amount: entry.amount, visual };
      }
    }
    if (strongest)
      impacts[target === "player" ? "playerImpactCue" : "enemyImpactCue"] = {
        ...strongest.visual,
      };
  }
  return { bursts, impacts };
}
