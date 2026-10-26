import { COMBAT_TEXT_BASE_SIZE_PX, COMBAT_TEXT_MOTION as M } from "@/lib/game-constants";
import { DAMAGE_TYPES, harmfulPlayerStatusIds } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle";
import type { CombatTextLane } from "../../shared/types";

const clamp = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => {
  const p = clamp(t);
  return p * p * (3 - 2 * p);
};
const out = (t: number) => 1 - (1 - clamp(t)) ** 3;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function combatTextLane(event: CombatTextEvent): Exclude<CombatTextLane, "announcement"> {
  if (event.feedback === "primary") return "impact";
  if (event.feedback !== "secondary" && (event.kind === "heal" || (event.kind === "notice" && event.stat === "dodge")))
    return "impact";
  if (event.kind === "damage" && event.feedback !== "secondary") {
    return event.impact !== false &&
      (event.stat === "health" || event.stat === "block" || DAMAGE_TYPES.some((type) => type === event.stat))
      ? "impact"
      : "setback";
  }
  if (event.kind === "damage") return "setback";
  const harmful = harmfulPlayerStatusIds.some((stat) => stat === event.stat) || event.stat === "deathsDoor";
  if (event.kind === "notice") {
    if (
      event.signal === "cleanse" ||
      event.signal === "immune" ||
      event.signal === "prepared" ||
      event.stat === "phoenixFeather"
    )
      return "benefit";
    return event.signal === "purge" || harmful ? "setback" : "benefit";
  }
  return event.amount < 0 !== harmful ? "setback" : "benefit";
}

/** Shared by launch-clearance planning and the renderer; no frame clock or RNG. */
export function combatTextFrame(lane: CombatTextLane, elapsed: number, lifetimeMs: number) {
  let scale: number;
  if (lane === "announcement") {
    scale = elapsed < 140 ? lerp(0.9, 1.08, smooth(elapsed / 140)) : lerp(1.08, 1, smooth((elapsed - 140) / 100));
  } else if (lane !== "impact") {
    scale =
      1.2 *
      (elapsed < 50
        ? lerp(0.85, 1.2, out(elapsed / 50))
        : elapsed < 90
          ? 1.2
          : lerp(1.2, 1, smooth((elapsed - 90) / 70)));
  } else if (elapsed < M.popMs) scale = lerp(M.initialScale, M.peakScale, out(elapsed / M.popMs));
  else if (elapsed < M.popMs + M.settleMs)
    scale = lerp(M.peakScale, M.holdScale, smooth((elapsed - M.popMs) / M.settleMs));
  else scale = lerp(M.holdScale, M.finalScale, smooth((elapsed - M.riseStartMs) / M.shrinkMs));
  const rise = lane === "impact" || lane === "announcement" ? M.risePx * out((elapsed - M.riseStartMs) / M.riseMs) : 0;
  const fadeMs = lane === "announcement" ? 350 : M.fadeMs;
  const fan = lane === "impact" ? M.fanStartPx + M.fanDriftPx * out(elapsed / M.fanMs) : 0;
  return { scale, y: -rise, fan, opacity: 1 - smooth((elapsed - (lifetimeMs - fadeMs)) / fadeMs) };
}

/** One route definition for collision planning and the CSS flight. */
export function combatTextRoute(lane: CombatTextLane, spread = 0) {
  const distance = Math.abs(spread);
  if (lane === "impact" && spread >= 10)
    return {
      side: [-1, 0, 1][(spread - 10) % 3]!,
      reach: 2,
      row: M.impactRowPx * 5 + Math.floor((spread - 10) / 3) * 16,
    };
  if (lane === "impact")
    return {
      side: spread >= 6 ? 0 : Math.sign(spread),
      reach: distance % 2 === 0 ? 2 : 1,
      row: (distance >= 6 ? distance - 5 : Math.max(0, distance - 1)) * M.impactRowPx,
    };
  return {
    side: 0,
    reach: 0,
    row:
      lane === "announcement"
        ? (spread < 0 ? -spread * 2 - 1 : spread * 2) * M.reactionRowPx
        : -(spread < 0 ? -spread * 2 - 1 : spread * 2) * M.statusRowPx,
  };
}

export function combatTextFootprint(lane: CombatTextLane, elapsed: number, lifetimeMs: number) {
  const frame = combatTextFrame(lane, elapsed, lifetimeMs);
  const multiplier = lane === "announcement" ? M.reactionSize : lane === "impact" ? 1 : M.statusSize;
  return { ...frame, height: COMBAT_TEXT_BASE_SIZE_PX * 1.15 * frame.scale * multiplier + 4 };
}
