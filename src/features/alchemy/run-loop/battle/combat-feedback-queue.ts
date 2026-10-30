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
  const reaction = item.presentation.lane === "announcement";
  const deadline = Math.max(now, item.receivedAt + (reaction ? M.maximumReactionQueueDelayMs : M.maximumQueueDelayMs));
  const gap = reaction ? M.reactionLaunchGapMs : M.minimumLaunchGapMs;
  return Math.min(deadline, Math.max(now, last ? last.presentation.launchAt + gap : now));
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
  if (
    ahead.every(
      (old) =>
        endsAt(old.presentation) <= launchAt || old.presentation.launchAt >= launchAt + item.presentation.lifetimeMs,
    )
  )
    return 0;
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
      ? [0]
      : item.presentation.lane !== "impact"
        ? [0, -1, 1, -2, 2, -3, 3]
        : item.family === "heal" && recentDamage
          ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, -1, -2, -3, -4, -5]
          : item.family === "damage" && recentHeal
            ? [-1, -2, -3, -4, -5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5]
            : [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, 6, 7, 8, 9];
  if (item.presentation.lane === "announcement") {
    const rows = Math.ceil((item.height ?? 64) / M.reactionRowPx) * (ahead.length + 1);
    for (let index = 1; index <= rows; index++) routes.push(-index, index);
  } else if (item.presentation.lane === "impact") {
    // Dense bursts can use extra fixed rows instead of reusing an occupied path.
    const extraRows = (Math.ceil(ahead.length / 3) + 1) * 3;
    for (let index = 0; index < extraRows; index++) routes.push(10 + index);
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
      const bounds = footprint(old, oldFrame, route);
      previous.push({
        left: bounds.x - bounds.width / 2,
        right: bounds.x + bounds.width / 2,
        top: bounds.y - bounds.height / 2,
        bottom: bounds.y + bounds.height / 2,
        area: bounds.width * bounds.height,
      });
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
      const left = next.x - next.width / 2;
      const right = next.x + next.width / 2;
      const top = next.y - next.height / 2;
      const bottom = next.y + next.height / 2;
      const area = next.width * next.height;
      for (const previous of sample.previous) {
        const width = Math.max(0, Math.min(right, previous.right) - Math.max(left, previous.left));
        const height = Math.max(0, Math.min(bottom, previous.bottom) - Math.max(top, previous.top));
        const covered = (width * height) / Math.min(area, previous.area);
        score += covered + (covered > 0.8 ? 1000 : 0);
        if (score >= bestScore) break;
      }
    }
    if (score < bestScore) {
      best = route;
      bestScore = score;
      // Scores cannot be negative, and ties retain the first route.
      if (score === 0) break;
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
    const visible: QueueItem[] = [];
    const waiting: QueueItem[] = [];
    for (const item of lane) {
      if (item.presentation.phase === "visible") visible.push(item);
      else if (item.presentation.phase === "waiting") waiting.push(item);
    }
    for (const item of visible) plans.set(item.id, item.presentation);
    // Keep every admitted entry and every active path. Time, rather than eviction,
    // bounds the backlog; dense arrivals may overlap instead of falling behind combat.
    waiting.sort(
      (a, b) =>
        a.receivedAt - b.receivedAt ||
        Number(b.presentation.lane === "announcement") - Number(a.presentation.lane === "announcement"),
    );
    const ahead = visible.sort((a, b) => a.presentation.launchAt - b.presentation.launchAt);
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
  const nextBursts: CombatTextBurst[] = [];
  for (const burst of bursts) {
    const entries: CombatTextBurst["entries"] = [];
    for (const entry of burst.entries) {
      const presentation = plans.get(entry.id);
      if (presentation) entries.push(presentation === entry.presentation ? entry : { ...entry, presentation });
    }
    if (!entries.length) continue;
    let end = -Infinity;
    for (const entry of entries) end = Math.max(end, endsAt(entry.presentation!));
    nextBursts.push({ ...burst, entries, lifetimeMs: end - burst.firstShownAt });
  }
  const nextReactions: ReactionAnnouncement[] = [];
  for (const reaction of reactions) {
    const presentation = plans.get(reaction.id);
    if (presentation)
      nextReactions.push(presentation === reaction.presentation ? reaction : { ...reaction, presentation });
  }
  return { floatingCombatBursts: nextBursts, reactionAnnouncements: nextReactions };
}

export function advanceCombatFeedback(bursts: CombatTextBurst[], reactions: ReactionAnnouncement[], now: number) {
  const advance = (presentation: CombatTextPresentation | undefined) => {
    if (!presentation) return presentation;
    return presentation.phase === "waiting" && presentation.launchAt <= now
      ? { ...presentation, phase: "visible" as const }
      : presentation;
  };
  const floatingCombatBursts: CombatTextBurst[] = [];
  for (const burst of bursts) {
    const entries: CombatTextBurst["entries"] = [];
    for (const entry of burst.entries) {
      if (entry.presentation && endsAt(entry.presentation) <= now) continue;
      const presentation = advance(entry.presentation);
      entries.push(!presentation || presentation === entry.presentation ? entry : { ...entry, presentation });
    }
    if (entries.length) floatingCombatBursts.push({ ...burst, entries });
  }
  const reactionAnnouncements: ReactionAnnouncement[] = [];
  for (const reaction of reactions) {
    if (reaction.presentation && endsAt(reaction.presentation) <= now) continue;
    const presentation = advance(reaction.presentation);
    reactionAnnouncements.push(
      !presentation || presentation === reaction.presentation ? reaction : { ...reaction, presentation },
    );
  }
  return { floatingCombatBursts, reactionAnnouncements };
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
