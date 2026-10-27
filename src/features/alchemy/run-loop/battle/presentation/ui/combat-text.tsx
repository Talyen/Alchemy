import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import {
  COMBAT_TEXT_BASE_SIZE_PX,
  COMBAT_TEXT_LIFETIME_MS,
  REACTION_TEXT_LIFETIME_MS,
  COMBAT_TEXT_MOTION as M,
} from "@/lib/game-constants";
import { ReactionTextRail } from "./reaction-text";
import type {
  CombatTextBurst,
  ReactionAnnouncement,
  CombatTextLane,
  CombatTextPresentation,
} from "../../../../shared/types";
import { CombatTextEntry } from "./combat-text-entry";
import { combatTextFrame, combatTextLane, combatTextRoute } from "../../combat-feedback-motion";
import { secondaryStatusFeedbackKey } from "../combat-status-feedback";

function animationFor(lane: CombatTextLane, lifetimeMs: number) {
  const times = [
    ...new Set(
      [
        0,
        50,
        85,
        90,
        140,
        160,
        170,
        240,
        770,
        1000,
        1050,
        1250,
        lifetimeMs,
        ...Array.from({ length: Math.ceil(lifetimeMs / M.sampleMs) }, (_, i) => i * M.sampleMs),
      ].filter((time) => time <= lifetimeMs),
    ),
  ].sort((a, b) => a - b);
  const frames = times.map((time) => combatTextFrame(lane, time, lifetimeMs));
  return {
    scale: frames.map((frame) => frame.scale),
    "--combat-text-rise": frames.map((frame) => frame.y),
    "--combat-text-fan": frames.map((frame) => frame.fan),
    opacity: frames.map((frame) => frame.opacity),
    transition: { duration: lifetimeMs / 1000, times: times.map((time) => time / lifetimeMs), ease: "linear" as const },
  };
}
const CORNER_GROWTH = (combatTextFrame("benefit", 50, COMBAT_TEXT_LIFETIME_MS).scale - 1) * 50;
const animations = {
  impact: animationFor("impact", COMBAT_TEXT_LIFETIME_MS),
  benefit: animationFor("benefit", COMBAT_TEXT_LIFETIME_MS),
  setback: animationFor("setback", COMBAT_TEXT_LIFETIME_MS),
  announcement: animationFor("announcement", REACTION_TEXT_LIFETIME_MS),
};
const initialFrames = {
  impact: combatTextFrame("impact", 0, COMBAT_TEXT_LIFETIME_MS),
  benefit: combatTextFrame("benefit", 0, COMBAT_TEXT_LIFETIME_MS),
  setback: combatTextFrame("setback", 0, COMBAT_TEXT_LIFETIME_MS),
  announcement: combatTextFrame("announcement", 0, REACTION_TEXT_LIFETIME_MS),
};

export function CombatTextRail({
  bursts,
  reactions = [],
}: {
  bursts: CombatTextBurst[];
  reactions?: ReactionAnnouncement[];
}) {
  const staticMotion = useReducedMotionPreference();
  let staticRows: Map<CombatTextLane, number> | undefined;
  const nextStaticRow = (lane: CombatTextLane, rows = 1) => {
    if (!staticMotion) return 0;
    staticRows ??= new Map();
    const key = lane === "announcement" ? "impact" : lane;
    const row = staticRows.get(key) ?? 0;
    staticRows.set(key, row + rows);
    return row;
  };
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 w-full"
      style={{
        fontSize: `calc(${COMBAT_TEXT_BASE_SIZE_PX}px * var(--content-scale, 1))`,
        containerType: "inline-size",
      }}
    >
      {bursts.map((burst) => {
        const entries = burst.entries.filter(
          (entry) => entry.presentation?.phase !== "waiting" && !(entry.kind === "notice" && entry.signal === "immune"),
        );
        if (!entries.length) return null;
        return (
          <div
            key={burst.id}
            data-testid="combat-text-burst"
            data-burst-id={burst.id}
            data-first-shown-at={burst.firstShownAt}
            data-target={burst.target}
            className="absolute inset-0"
          >
            {entries.map((entry) => {
              const lane = entry.presentation?.lane ?? combatTextLane(entry);
              return (
                <FeedbackFlight
                  key={entry.id}
                  statusFeedbackKey={secondaryStatusFeedbackKey(entry, lane)}
                  lane={lane}
                  spread={entry.presentation?.spread ?? 0}
                  staticMotion={staticMotion}
                  staticRow={nextStaticRow(lane)}
                >
                  <CombatTextEntry entry={entry} staticMotion={staticMotion} />
                </FeedbackFlight>
              );
            })}
          </div>
        );
      })}
      {reactions
        .filter((reaction) => reaction.presentation?.phase !== "waiting")
        .map((reaction) => (
          <FeedbackFlight
            key={reaction.id}
            lane="announcement"
            spread={reaction.presentation?.spread ?? 0}
            staticMotion={staticMotion}
            staticRow={nextStaticRow("announcement", reaction.reactionIds.length + 2)}
          >
            <ReactionTextRail announcements={[reaction]} />
          </FeedbackFlight>
        ))}
    </div>
  );
}

function FeedbackFlight({
  lane,
  spread,
  staticMotion,
  staticRow,
  children,
  statusFeedbackKey,
}: {
  lane: CombatTextLane;
  spread: NonNullable<CombatTextPresentation["spread"]>;
  staticMotion: boolean;
  staticRow: number;
  children: ReactNode;
  statusFeedbackKey?: string | undefined;
}) {
  const firstFrame = initialFrames[lane];
  const initial = staticMotion
    ? false
    : {
        scale: firstFrame.scale,
        opacity: firstFrame.opacity,
        "--combat-text-rise": firstFrame.y,
        "--combat-text-fan": firstFrame.fan,
      };
  const quiet = lane === "benefit" || lane === "setback";
  // Percent translations measure the label itself, not the portrait. Reserve its
  // peak pop footprint so both narrow heroes and wide bosses sit at the corner.
  const cornerGrowth = staticMotion ? 0 : CORNER_GROWTH;
  const cornerInset = "calc(6px * var(--content-scale, 1))";
  const route = combatTextRoute(lane, spread);
  const rowOffset = staticMotion ? 0 : route.row;
  const fan =
    staticMotion || lane !== "impact"
      ? "0px"
      : `calc(${route.side} * min(calc(var(--combat-text-fan, 0) * ${route.reach}px * var(--content-scale, 1)), max(0px, calc((100cqw - ${M.peakScale * 100}%) / 2 - 8px * var(--content-scale, 1)))))`;
  return (
    <div
      data-feedback-lane={lane}
      data-feedback-spread={spread}
      data-secondary-status-feedback={statusFeedbackKey}
      className="absolute"
      style={{
        left: lane === "benefit" ? cornerInset : lane === "setback" ? undefined : "50%",
        right: lane === "setback" ? cornerInset : undefined,
        top: quiet
          ? undefined
          : `calc(40% - ${lane === "announcement" ? M.reactionOffsetPx : 0}px * var(--content-scale, 1) ${lane === "announcement" ? "+" : "-"} ${staticRow * 1.5}em + ${rowOffset}px * var(--content-scale, 1))`,
        bottom: quiet
          ? `calc(${cornerInset} + ${staticRow * 1.5}em - ${rowOffset}px * var(--content-scale, 1))`
          : undefined,
        transform: quiet
          ? `translate(${lane === "benefit" ? cornerGrowth : -cornerGrowth}%, -${cornerGrowth}%)`
          : "translate(-50%, -50%)",
        width: lane === "announcement" ? "100%" : "max-content",
        fontSize: quiet ? `${M.statusSize}em` : undefined,
      }}
    >
      <motion.div
        data-testid="combat-feedback-action"
        className="flex w-full items-center justify-center [line-height:1.15] font-bold tracking-wide [filter:drop-shadow(0_0_1px_rgb(0,0,0))_drop-shadow(0_1px_2px_rgba(0,0,0,0.95))]"
        initial={initial}
        style={{ translate: `${fan} calc(var(--combat-text-rise, 0) * 1px * var(--content-scale, 1))` }}
        animate={staticMotion ? { scale: 1, "--combat-text-rise": 0, opacity: 1 } : animations[lane]}
      >
        {children}
      </motion.div>
    </div>
  );
}
