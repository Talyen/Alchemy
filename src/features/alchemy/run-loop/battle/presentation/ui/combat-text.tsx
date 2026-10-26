import { useGameTranslation } from "@/components/use-game-translation";
import { createElement, type ReactNode } from "react";
import { motion } from "motion/react";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { cn } from "@/lib/utils";
import {
  COMBAT_TEXT_BASE_SIZE_PX,
  COMBAT_TEXT_LIFETIME_MS,
  REACTION_TEXT_LIFETIME_MS,
  COMBAT_TEXT_MOTION as M,
} from "@/lib/game-constants";
import { ReactionTextRail } from "./reaction-text";
import type {
  CombatTextBurst,
  FloatingCombatText,
  ReactionAnnouncement,
  CombatTextLane,
  CombatTextPresentation,
} from "../../../../shared/types";
import {
  getCombatTextColorClass,
  getCombatTextIcon,
  getCombatTextLeadingIcon,
  getCombatTextAccessibleLabel,
} from "../../../../shared/utils/index";
import { combatTextFrame, combatTextLane, combatTextRoute } from "../../combat-feedback-motion";

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
const animations = {
  impact: animationFor("impact", COMBAT_TEXT_LIFETIME_MS),
  benefit: animationFor("benefit", COMBAT_TEXT_LIFETIME_MS),
  setback: animationFor("setback", COMBAT_TEXT_LIFETIME_MS),
  announcement: animationFor("announcement", REACTION_TEXT_LIFETIME_MS),
};

export function CombatTextRail({
  bursts,
  reactions = [],
}: {
  bursts: CombatTextBurst[];
  reactions?: ReactionAnnouncement[];
}) {
  const staticMotion = useReducedMotionPreference();
  const staticRows = new Map<CombatTextLane, number>();
  const nextStaticRow = (lane: CombatTextLane) => {
    const row = staticRows.get(lane) ?? 0;
    staticRows.set(lane, row + 1);
    return staticMotion ? row : 0;
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
        const entries = burst.entries.filter((entry) => entry.presentation?.phase !== "waiting");
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
            staticRow={nextStaticRow("announcement")}
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
}: {
  lane: CombatTextLane;
  spread: NonNullable<CombatTextPresentation["spread"]>;
  staticMotion: boolean;
  staticRow: number;
  children: ReactNode;
}) {
  const firstFrame = combatTextFrame(
    lane,
    0,
    lane === "announcement" ? REACTION_TEXT_LIFETIME_MS : COMBAT_TEXT_LIFETIME_MS,
  );
  const initial = {
    scale: firstFrame.scale,
    opacity: firstFrame.opacity,
    "--combat-text-rise": firstFrame.y,
    "--combat-text-fan": firstFrame.fan,
  };
  const quiet = lane === "benefit" || lane === "setback";
  // Percent translations measure the label itself, not the portrait. Reserve its
  // peak pop footprint so both narrow heroes and wide bosses sit at the corner.
  const cornerGrowth = staticMotion ? 0 : (combatTextFrame("benefit", 50, COMBAT_TEXT_LIFETIME_MS).scale - 1) * 50;
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
        initial={staticMotion ? false : initial}
        style={{ translate: `${fan} calc(var(--combat-text-rise, 0) * 1px * var(--content-scale, 1))` }}
        animate={staticMotion ? { scale: 1, "--combat-text-rise": 0, opacity: 1 } : animations[lane]}
      >
        {children}
      </motion.div>
    </div>
  );
}

function CombatTextEntry({ entry, staticMotion }: { entry: FloatingCombatText; staticMotion: boolean }) {
  const i18n = useGameTranslation();
  const icon = getCombatTextIcon(entry);
  const leading = getCombatTextLeadingIcon(entry);
  return (
    <div
      data-testid="combat-text"
      aria-label={i18n.read(() => getCombatTextAccessibleLabel(entry))}
      data-kind={entry.kind}
      data-stat={entry.stat}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
        getCombatTextColorClass(entry),
        entry.kind === "damage" &&
          entry.critical &&
          (staticMotion ? "combat-text-critical-static" : "combat-text-critical"),
      )}
    >
      {i18n.displayText(
        leading
          ? createElement(leading, {
              "aria-hidden": true,
              style: { width: "0.94em", height: "0.94em", strokeWidth: 3 },
            })
          : null,
      )}
      {i18n.displayText(
        icon
          ? createElement(icon, {
              style: {
                width: "0.94em",
                height: "0.94em",
                strokeWidth: 3,
              },
            })
          : null,
      )}
      {entry.displayText ? (
        <span
          style={{
            WebkitTextStroke: "1.5px rgba(0, 0, 0, 0.95)",
            paintOrder: "stroke fill",
            fontVariantNumeric: "tabular-nums",
            textAlign: "center",
            width:
              entry.reservedDigits === undefined
                ? undefined
                : `${entry.reservedDigits + (/^[+-]/.test(entry.displayText) ? 1 : 0)}ch`,
          }}
        >
          {i18n.displayText(entry.displayText)}
        </span>
      ) : null}
    </div>
  );
}
