import { mergeCombatText, type CombatTextEvent } from "@/lib/battle";
import type { CombatImpactCue, CombatTextBurst, ReactionAnnouncement, FloatingCombatText } from "../../shared/types";
import { DAMAGE_TYPES, type DamageType } from "@/lib/game-data";
import { REACTION_TEXT_LIFETIME_MS } from "@/lib/game-constants";
import { getCombatImpactVisual } from "../../shared/utils";
import { combatTextDisplay } from "./combat-feedback-merge";

/** Converts a resolved action without mutating events or reading runtime state. */
export function prepareCombatFeedback(
  events: readonly CombatTextEvent[],
  actionId: number,
  now: number,
  lifetimeMs: number,
) {
  const consolidated: Array<CombatTextEvent & { includesCritical?: boolean }> = [];
  const reactions: ReactionAnnouncement[] = [];
  // Resolved frames can be saved and replayed; presentation must never mutate their events.
  for (const event of events) {
    // Immunity is already represented by the persistent control-immunity chip.
    // Keep its engine receipt for mechanics/audio, without allocating a floating flight.
    if (event.kind === "notice" && event.signal === "immune") continue;
    if (event.kind === "notice" && event.signal === "reaction") {
      let announcement = reactions.find(
        (entry) => entry.target === event.target && entry.reactionIds.includes(event.reactionId),
      );
      if (!announcement) {
        announcement = {
          id: `reaction-${actionId}-${event.target}-${event.reactionId}`,
          burstId: `combat-burst-${actionId}-${event.target}`,
          target: event.target,
          reactionIds: [],
          entries: [],
          firstShownAt: now,
          lifetimeMs: REACTION_TEXT_LIFETIME_MS,
        };
        reactions.push(announcement);
      }
      if (!announcement.reactionIds.includes(event.reactionId)) announcement.reactionIds.push(event.reactionId);
      continue;
    }
    if (event.kind === "damage" && event.impact !== false && DAMAGE_TYPES.includes(event.stat as DamageType)) {
      const index = consolidated.findIndex(
        (entry) =>
          entry.kind === "damage" &&
          entry.impact !== false &&
          entry.target === event.target &&
          entry.stat === event.stat &&
          entry.reactionId === event.reactionId &&
          entry.feedback === event.feedback &&
          Math.sign(entry.amount) === Math.sign(event.amount),
      );
      const previous = consolidated[index];
      if (previous?.kind === "damage") {
        // Repeated packets of one origin can total; direct and different reaction payoffs stay distinct.
        const merged = [{ ...previous, impact: true, additive: true, periodic: false }];
        mergeCombatText(merged, { ...event, impact: true, additive: true, periodic: false });
        const { impact: _impact, additive: _additive, periodic: _periodic, ...aggregate } = merged[0]!;
        consolidated[index] = {
          ...previous,
          ...aggregate,
          ...(previous.periodic !== event.periodic ? { periodic: false } : {}),
          includesCritical: previous.critical === true || event.critical === true,
        };
        continue;
      }
    }
    mergeCombatText(consolidated, { ...event });
  }
  const priority = (event: CombatTextEvent) => (event.kind === "notice" ? 0 : event.kind === "damage" ? 1 : 2);
  consolidated.sort((a, b) => priority(a) - priority(b));
  const byTarget: Record<
    CombatTextEvent["target"],
    Array<CombatTextEvent & Pick<FloatingCombatText, "includesCritical">>
  > = { player: [], enemy: [] };
  let hasMeaningful = false;
  const hasPrimaryResult = consolidated.some(
    (event) => event.feedback === "primary" && (event.kind === "notice" || event.amount !== 0),
  );
  for (const event of consolidated) {
    if (event.kind !== "notice" && event.amount === 0 && !(event.feedback === "primary" && !hasPrimaryResult)) continue;
    byTarget[event.target].push(event);
    hasMeaningful = true;
  }
  const fallback = consolidated[0];
  if (!hasMeaningful && fallback) byTarget[fallback.target].push(fallback);
  const bursts: CombatTextBurst[] = [];
  const impacts: Partial<Record<"playerImpactCue" | "enemyImpactCue", Omit<CombatImpactCue, "sequence" | "recoil">>> =
    {};
  for (const target of ["player", "enemy"] as const) {
    const entries = byTarget[target];
    if (entries.length === 0) continue;
    const id = `combat-burst-${actionId}-${target}`;
    const burst: CombatTextBurst = {
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
    };
    for (const reaction of reactions.filter((entry) => entry.target === target)) {
      reaction.entries = burst.entries.filter(
        (entry) =>
          entry.kind === "damage" &&
          entry.impact !== false &&
          DAMAGE_TYPES.includes(entry.stat as DamageType) &&
          entry.reactionId !== undefined &&
          reaction.reactionIds.includes(entry.reactionId),
      );
      burst.entries = burst.entries.filter((entry) => !reaction.entries.includes(entry));
    }
    if (burst.entries.length) bursts.push(burst);
    let strongest: { amount: number; visual: NonNullable<ReturnType<typeof getCombatImpactVisual>> } | undefined;
    for (const entry of events) {
      if (entry.target !== target) continue;
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
  return { bursts, impacts, reactions };
}
