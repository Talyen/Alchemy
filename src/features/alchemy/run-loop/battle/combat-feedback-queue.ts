import { COMBAT_TEXT_BASE_SIZE_PX, COMBAT_TEXT_MOTION as M } from "@/lib/game-constants";
import type { CombatTextBurst, CombatTextPresentation, ReactionAnnouncement } from "../../shared/types";
import { combatTextFootprint, combatTextLane, combatTextRoute } from "./combat-feedback-motion";

interface QueueItem {
  id: string;
  target: CombatTextBurst["target"];
  receivedAt: number;
  presentation: CombatTextPresentation;
  family: "damage" | "heal" | "other";
  width: number;
  height?: number;
  scheduled: boolean;
}
const endsAt = (item: CombatTextPresentation) => item.launchAt + item.lifetimeMs;

function staggeredLaunch(item: QueueItem, ahead: QueueItem[], now: number) {
  const last = ahead.findLast((other) => other.presentation.lane === item.presentation.lane);
  const deadline = Math.max(now, item.receivedAt + M.maximumQueueDelayMs);
  return Math.min(deadline, Math.max(now, last ? last.presentation.launchAt + M.minimumLaunchGapMs : now));
}

type Spread = NonNullable<CombatTextPresentation["spread"]>;

function footprint(
  item: QueueItem,
  frame: ReturnType<typeof combatTextFootprint>,
  route: ReturnType<typeof combatTextRoute>,
) {
  const plan = item.presentation;
  const impact = plan.lane === "impact";
  const row = route.row - (plan.lane === "announcement" ? M.reactionOffsetPx : 0);
  const maximumFan = Math.max(0, (280 - item.width * M.peakScale) / 2 - 8);
  const x = impact
    ? route.side * Math.min(frame.fan * route.reach, maximumFan)
    : plan.lane === "benefit"
      ? -84
      : plan.lane === "setback"
        ? 84
        : 0;
  return {
    x,
    y: frame.y + row + (plan.lane === "benefit" || plan.lane === "setback" ? 96.6 : 0),
    width: item.width * frame.scale + M.clearancePx,
    height: (item.height === undefined ? frame.height : item.height * frame.scale) + M.clearancePx,
    opacity: frame.opacity,
  };
}

function spreadFor(item: QueueItem, ahead: QueueItem[], launchAt: number): Spread {
  if (ahead.length === 0) return 0;
  let recentDamage = false;
  let recentHeal = false;
  if (item.presentation.lane === "impact") {
    for (const other of ahead) {
      if (other.presentation.lane !== "impact" || other.presentation.launchAt + M.nearbyLaunchWindowMs < launchAt)
        continue;
      if (other.family === "damage") recentDamage = true;
      if (other.family === "heal") recentHeal = true;
    }
  }
  const routes: Spread[] =
    item.presentation.lane === "announcement"
      ? [
          0,
          ...Array.from(
            { length: Math.ceil((item.height ?? 64) / M.reactionRowPx) * (ahead.length + 1) },
            (_, index) => [-(index + 1), index + 1],
          ).flat(),
        ]
      : item.presentation.lane !== "impact"
        ? [0, -1, 1, -2, 2, -3, 3]
        : item.family === "heal" && recentDamage
          ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, -1, -2, -3, -4, -5]
          : item.family === "damage" && recentHeal
            ? [-1, -2, -3, -4, -5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5]
            : [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, 6, 7, 8, 9];
  if (item.presentation.lane === "impact") {
    // Dense bursts can use extra fixed rows instead of reusing an occupied path.
    routes.push(...Array.from({ length: (Math.ceil(ahead.length / 3) + 1) * 3 }, (_, index) => 10 + index));
  }
  const oldRoutes = new Map<QueueItem, ReturnType<typeof combatTextRoute>>();
  const samples = [];
  for (let elapsed = 0; elapsed < item.presentation.lifetimeMs; elapsed += M.sampleMs) {
    const at = launchAt + elapsed;
    const frame = combatTextFootprint(item.presentation.lane, at - launchAt, item.presentation.lifetimeMs);
    if (frame.opacity < 0.15) continue;
    const previous = [];
    for (const old of ahead) {
      if (at < old.presentation.launchAt || at >= endsAt(old.presentation)) continue;
      const oldFrame = combatTextFootprint(
        old.presentation.lane,
        at - old.presentation.launchAt,
        old.presentation.lifetimeMs,
      );
      if (!(oldFrame.opacity >= 0.15)) continue;
      let route = oldRoutes.get(old);
      if (!route) {
        route = combatTextRoute(old.presentation.lane, old.presentation.spread ?? 0);
        oldRoutes.set(old, route);
      }
      previous.push(footprint(old, oldFrame, route));
    }
    samples.push({ frame, previous });
  }
  let best = routes[0]!;
  let bestScore = Infinity;
  // Only the new flight receives a route. Cache existing footprints so dense
  // arrival batches do not repeatedly sample the same older animations.
  for (const route of routes) {
    let score = Math.abs(route) * 0.001;
    const routeGeometry = combatTextRoute(item.presentation.lane, route);
    for (const sample of samples) {
      // Overlap penalties cannot decrease the score; ties keep the earlier route.
      if (score >= bestScore) break;
      if (sample.previous.length === 0) continue;
      const next = footprint(item, sample.frame, routeGeometry);
      for (const previous of sample.previous) {
        const width = Math.max(
          0,
          Math.min(next.x + next.width / 2, previous.x + previous.width / 2) -
            Math.max(next.x - next.width / 2, previous.x - previous.width / 2),
        );
        const height = Math.max(
          0,
          Math.min(next.y + next.height / 2, previous.y + previous.height / 2) -
            Math.max(next.y - next.height / 2, previous.y - previous.height / 2),
        );
        const covered = (width * height) / Math.min(next.width * next.height, previous.width * previous.height);
        score += covered + (covered > 0.8 ? 1000 : 0);
      }
    }
    if (score < bestScore) {
      best = route;
      bestScore = score;
    }
  }
  return best;
}

function ungroupedReactionCount(reaction: ReactionAnnouncement): number {
  let count = 0;
  for (const entry of reaction.entries) if (entry.kind !== "notice" && !entry.reactionId) count++;
  return count;
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
        scheduled: entry.presentation !== undefined,
        width:
          COMBAT_TEXT_BASE_SIZE_PX *
          (0.56 *
            ((entry.reservedDigits ??
              (entry.kind === "notice" ? entry.displayText.length : String(Math.abs(entry.amount)).length)) +
              (/^[+-]/.test(entry.displayText) ? 1 : 0)) +
            1.13),
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
      scheduled: reaction.presentation !== undefined,
      family: "other" as const,
      width: 280,
      height:
        COMBAT_TEXT_BASE_SIZE_PX *
        (reaction.reactionIds.length * 1.5 + Math.ceil(ungroupedReactionCount(reaction) / 2) * 1.9),
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
    const key = item.target;
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
      .sort(
        (a, b) =>
          a.receivedAt - b.receivedAt ||
          Number(b.presentation.lane === "announcement") - Number(a.presentation.lane === "announcement"),
      );
    const ahead = [...visible].sort((a, b) => a.presentation.launchAt - b.presentation.launchAt);
    for (const item of waiting) {
      const launchAt = item.scheduled ? item.presentation.launchAt : staggeredLaunch(item, ahead, now);
      const presentation: CombatTextPresentation = {
        ...item.presentation,
        launchAt,
        spread: item.presentation.spread ?? (staticMotion ? 0 : spreadFor(item, ahead, launchAt)),
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
    let end = -Infinity;
    for (const entry of entries) end = Math.max(end, endsAt(entry.presentation!));
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
        return [!presentation || presentation === entry.presentation ? entry : { ...entry, presentation }];
      });
      return entries.length ? [{ ...burst, entries }] : [];
    }),
    reactionAnnouncements: reactions.flatMap((reaction) => {
      if (reaction.presentation && endsAt(reaction.presentation) <= now) return [];
      const presentation = advance(reaction.presentation);
      return [!presentation || presentation === reaction.presentation ? reaction : { ...reaction, presentation }];
    }),
  };
}

export function nextCombatFeedbackDeadline(bursts: CombatTextBurst[], reactions: ReactionAnnouncement[]) {
  let deadline = Infinity;
  const consider = (plan: CombatTextPresentation | undefined) => {
    if (plan) deadline = Math.min(deadline, plan.phase === "waiting" ? plan.launchAt : endsAt(plan));
  };
  for (const burst of bursts) for (const entry of burst.entries) consider(entry.presentation);
  for (const reaction of reactions) consider(reaction.presentation);
  return deadline;
}
