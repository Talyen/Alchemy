import { mergeCombatText, type CombatTextEvent } from "@/lib/battle";
import type { CombatImpactCue, CombatTextBurst, ReactionAnnouncement, FloatingCombatText } from "../../shared/types";
import { DAMAGE_TYPES, type DamageType } from "@/lib/game-data";
import { REACTION_TEXT_LIFETIME_MS } from "@/lib/game-constants";
import { getCombatImpactVisual } from "../../shared/utils";
import { combatTextDisplay } from "./combat-feedback-merge";

const FEEDBACK_TARGETS = ["player", "enemy"] as const;

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
  for (const source of events) {
    const event =
      source.kind === "damage" && source.detonation
        ? { ...source, feedback: "primary" as const, additive: false }
        : source;
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
          reactionIds: [event.reactionId],
          entries: [],
          firstShownAt: now,
          lifetimeMs: REACTION_TEXT_LIFETIME_MS,
        };
        reactions.push(announcement);
      }
      continue;
    }
    if (event.kind === "damage" && event.impact !== false && DAMAGE_TYPES.includes(event.stat as DamageType)) {
      const index = consolidated.findIndex(
        (entry) =>
          entry.kind === "damage" &&
          entry.impact !== false &&
          entry.target === event.target &&
          entry.stat === event.stat &&
          entry.companionActionId === event.companionActionId &&
          !!entry.periodic === !!event.periodic &&
          entry.reactionId === event.reactionId &&
          entry.feedback === event.feedback &&
          Math.sign(entry.amount) === Math.sign(event.amount),
      );
      const previous = consolidated[index];
      if (previous?.kind === "damage") {
        // One action's same-type hit and detonation share a total; keep the
        // original receipts for audio, impact strength and Critical attribution.
        const detonation = previous.detonation ?? event.detonation;
        const details = { impact: true, additive: true, periodic: false, ...(detonation ? { detonation } : {}) };
        const merged = [{ ...previous, ...details }];
        mergeCombatText(merged, { ...event, ...details });
        const { impact: _impact, additive: _additive, periodic: _periodic, ...aggregate } = merged[0]!;
        consolidated[index] = {
          ...previous,
          ...aggregate,
          ...(detonation ? { additive: false } : {}),
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
  for (const target of FEEDBACK_TARGETS) {
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
    for (const reaction of reactions) {
      if (reaction.target !== target) continue;
      const remaining: typeof burst.entries = [];
      reaction.entries = [];
      for (const entry of burst.entries) {
        if (
          entry.kind === "damage" &&
          entry.impact !== false &&
          DAMAGE_TYPES.includes(entry.stat as DamageType) &&
          entry.reactionId !== undefined &&
          reaction.reactionIds.includes(entry.reactionId)
        )
          reaction.entries.push(entry);
        else remaining.push(entry);
      }
      burst.entries = remaining;
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
