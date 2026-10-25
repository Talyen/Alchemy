import { COMBAT_TEXT_MOTION as M } from "@/lib/game-constants";
import type { CombatTextBurst, CombatTextPresentation, ReactionAnnouncement } from "../../shared/types";
import { combatTextFootprint, combatTextLane } from "./combat-feedback-motion";

interface QueueItem {
  id: string;
  target: CombatTextBurst["target"];
  receivedAt: number;
  presentation: CombatTextPresentation;
  family: "damage" | "heal" | "other";
}
const endsAt = (item: CombatTextPresentation) => item.launchAt + item.lifetimeMs;

function firstClearLaunch(item: QueueItem, ahead: QueueItem[], now: number, staticMotion: boolean) {
  const last = ahead.findLast((other) => other.presentation.lane === item.presentation.lane);
  const deadline = Math.max(now, item.receivedAt + M.maximumQueueDelayMs);
  let launch = Math.min(deadline, Math.max(now, last ? last.presentation.launchAt + M.minimumLaunchGapMs : now));
  const clear = (candidate: number) =>
    ahead.every(({ presentation: old }) => {
      if (endsAt(old) <= candidate) return true;
      if (staticMotion) return old.lane !== item.presentation.lane;
      const end = Math.min(endsAt(old), candidate + item.presentation.lifetimeMs);
      for (let t = Math.max(candidate, old.launchAt); t < end; t += M.sampleMs) {
        const previous = combatTextFootprint(old.lane, t - old.launchAt, old.lifetimeMs);
        const next = combatTextFootprint(item.presentation.lane, t - candidate, item.presentation.lifetimeMs);
        if (previous.opacity < 0.15 || next.opacity < 0.15) continue;
        const previousY = previous.y - (old.lane === "announcement" ? M.reactionOffsetPx : 0);
        const nextY = next.y - (item.presentation.lane === "announcement" ? M.reactionOffsetPx : 0);
        if (Math.abs(previousY - nextY) < (previous.height + next.height) / 2 + M.clearancePx) return false;
      }
      return true;
    });
  // Clearance is a preference. Feedback must stay close to its hit, even in a dense burst.
  while (launch < deadline && !clear(launch)) launch += M.sampleMs;
  return Math.min(launch, deadline);
}

function spreadFor(item: QueueItem, ahead: QueueItem[], launchAt: number): -2 | -1 | 0 | 1 | 2 {
  const recent = ahead.filter(
    (other) =>
      other.presentation.lane === item.presentation.lane &&
      other.presentation.launchAt + M.nearbyLaunchWindowMs >= launchAt,
  );
  if (!recent.length) return 0;
  if (item.presentation.lane === "announcement") return ([-1, 1, -2, 2] as const)[(recent.length - 1) % 4]!;
  if (item.presentation.lane === "impact") {
    if (item.family === "heal" && recent.some((other) => other.family === "damage")) return 1;
    if (item.family === "damage" && recent.some((other) => other.family === "heal")) return -1;
    if (recent.length < 2) return 0;
  }
  return recent.findLast((other) => other.presentation.spread)?.presentation.spread === -1 ? 1 : -1;
}

/** Owns pending launches and expiry without moving, restarting, or extending visible entries. */
export function scheduleCombatFeedback(
  bursts: CombatTextBurst[],
  reactions: ReactionAnnouncement[],
  now: number,
  lifetimeMs: number,
  staticMotion: boolean,
) {
  const items: QueueItem[] = [
    ...bursts.flatMap((burst) =>
      burst.entries.map((entry) => ({
        id: entry.id,
        target: burst.target,
        receivedAt: burst.firstShownAt,
        family:
          entry.kind === "heal"
            ? ("heal" as const)
            : entry.kind === "damage" && entry.stat !== "block"
              ? ("damage" as const)
              : ("other" as const),
        presentation: entry.presentation ?? {
          lane: combatTextLane(entry),
          launchAt: now,
          lifetimeMs,
          phase: "waiting" as const,
        },
      })),
    ),
    ...reactions.map((reaction) => ({
      id: reaction.id,
      target: reaction.target,
      receivedAt: reaction.firstShownAt,
      family: "other" as const,
      presentation: reaction.presentation ?? {
        lane: "announcement" as const,
        launchAt: now,
        lifetimeMs: reaction.lifetimeMs,
        phase: "waiting" as const,
      },
    })),
  ];
  const lanes = new Map<string, QueueItem[]>();
  for (const item of items) {
    if (item.presentation.phase === "visible" && endsAt(item.presentation) <= now) continue;
    const key = `${item.target}-${item.presentation.lane === "announcement" ? "impact" : item.presentation.lane}`;
    const lane = lanes.get(key) ?? [];
    lane.push(item);
    lanes.set(key, lane);
  }
  const plans = new Map<string, CombatTextPresentation>();
  for (const lane of lanes.values()) {
    const visible = lane.filter((item) => item.presentation.phase === "visible");
    for (const item of visible) plans.set(item.id, item.presentation);
    // Keep every admitted entry and every active path. Time, rather than eviction,
    // bounds the backlog; dense arrivals may overlap instead of falling behind combat.
    const waiting = lane
      .filter((item) => item.presentation.phase === "waiting")
      .sort((a, b) => a.receivedAt - b.receivedAt);
    const ahead = [...visible].sort((a, b) => a.presentation.launchAt - b.presentation.launchAt);
    for (const item of waiting) {
      const launchAt = firstClearLaunch(item, ahead, now, staticMotion);
      const presentation: CombatTextPresentation = {
        ...item.presentation,
        launchAt,
        spread: item.presentation.spread ?? spreadFor(item, ahead, launchAt),
        phase: launchAt <= now ? "visible" : "waiting",
      };
      plans.set(item.id, presentation);
      ahead.push({ ...item, presentation });
    }
  }
  const nextBursts = bursts.flatMap((burst) => {
    const entries = burst.entries.flatMap((entry) => {
      const presentation = plans.get(entry.id);
      return presentation ? [presentation === entry.presentation ? entry : { ...entry, presentation }] : [];
    });
    if (!entries.length) return [];
    const end = Math.max(...entries.map((entry) => endsAt(entry.presentation!)));
    return [{ ...burst, entries, lifetimeMs: end - burst.firstShownAt }];
  });
  const nextReactions = reactions.flatMap((reaction) => {
    const presentation = plans.get(reaction.id);
    return presentation ? [presentation === reaction.presentation ? reaction : { ...reaction, presentation }] : [];
  });
  return { floatingCombatBursts: nextBursts, reactionAnnouncements: nextReactions };
}

export function advanceCombatFeedback(bursts: CombatTextBurst[], reactions: ReactionAnnouncement[], now: number) {
  const advance = (presentation: CombatTextPresentation | undefined) => {
    if (!presentation) return presentation;
    return presentation.phase === "waiting" && presentation.launchAt <= now
      ? { ...presentation, phase: "visible" as const }
      : presentation;
  };
  return {
    floatingCombatBursts: bursts.flatMap((burst) => {
      const entries = burst.entries.flatMap((entry) => {
        if (entry.presentation && endsAt(entry.presentation) <= now) return [];
        const presentation = advance(entry.presentation);
        return [presentation === entry.presentation ? entry : { ...entry, presentation }];
      });
      return entries.length ? [{ ...burst, entries }] : [];
    }),
    reactionAnnouncements: reactions.flatMap((reaction) => {
      if (reaction.presentation && endsAt(reaction.presentation) <= now) return [];
      const presentation = advance(reaction.presentation);
      return [presentation === reaction.presentation ? reaction : { ...reaction, presentation }];
    }),
  };
}

export function nextCombatFeedbackDeadline(bursts: CombatTextBurst[], reactions: ReactionAnnouncement[]) {
  const plans = [
    ...bursts.flatMap((burst) => burst.entries.map((entry) => entry.presentation)),
    ...reactions.map((reaction) => reaction.presentation),
  ];
  return Math.min(...plans.flatMap((plan) => (plan ? [plan.phase === "waiting" ? plan.launchAt : endsAt(plan)] : [])));
}
