import { createElement, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { cn } from "@/lib/utils";

import type { CombatTextBurst, FloatingCombatText } from "../../types";
import { getCombatTextColorClass, getCombatTextIcon } from "../../utils";

const FCT_BASE_SIZE_CQH = 3.5;
const FCT_POP_SCALE = 2.0;
const FCT_HOLD_SCALE = 1.8;
const FCT_POP_DURATION = 0.2;
const FCT_HOLD_DURATION = 0.2;
const FCT_SHRINK_DURATION = 0.5;
const FCT_RISE_DURATION = 0.7;
const FCT_RISE_DISTANCE_PX = 240;
const FCT_FADE_DURATION = 0.4;

const FCT_ANIMATION_PROPS = (() => {
  const popScale = FCT_POP_SCALE;
  const holdScale = FCT_HOLD_SCALE;
  const popDuration = FCT_POP_DURATION;
  const holdDuration = FCT_HOLD_DURATION;
  const shrinkDuration = FCT_SHRINK_DURATION;
  const riseDuration = FCT_RISE_DURATION;
  const riseDistance = FCT_RISE_DISTANCE_PX;
  const fadeDuration = FCT_FADE_DURATION;

  const tPopPeak = popDuration * 0.75;
  const tPopEnd = popDuration;
  const tHoldEnd = tPopEnd + holdDuration;
  const totalDuration = tHoldEnd + riseDuration;

  const tShrinkEnd = Math.min(totalDuration, tHoldEnd + shrinkDuration);
  const tFadeStart = Math.max(tHoldEnd, totalDuration - fadeDuration);

  const riseSteps = Array.from({ length: 11 }, (_, i) => tHoldEnd + (i / 10) * (totalDuration - tHoldEnd));

  const rawTimestamps = Array.from(
    new Set([0, tPopPeak, tPopEnd, tHoldEnd, tShrinkEnd, tFadeStart, ...riseSteps, totalDuration]),
  ).sort((a, b) => a - b);

  const lerp = (start: number, end: number, progress: number) =>
    start + (end - start) * Math.min(1, Math.max(0, progress));

  const getRiseEaseIn = (p: number) => Math.pow(Math.min(1, Math.max(0, p)), 3);

  const scaleAt = (t: number) => {
    if (t <= 0) return 0.5;
    if (t <= tPopPeak) return lerp(0.5, popScale, t / tPopPeak);
    if (t <= tPopEnd) return lerp(popScale, holdScale, (t - tPopPeak) / (tPopEnd - tPopPeak));
    if (t <= tHoldEnd) return holdScale;
    const shrinkProg = Math.min(1, (t - tHoldEnd) / shrinkDuration);
    return lerp(holdScale, 1.0, shrinkProg);
  };

  const yAt = (t: number) => {
    if (t <= tHoldEnd) return 0;
    const riseProg = (t - tHoldEnd) / riseDuration;
    return -riseDistance * getRiseEaseIn(riseProg);
  };

  const opacityAt = (t: number) => {
    if (t <= tFadeStart) return 1.0;
    if (t >= totalDuration) return 0.0;
    const fadeProg = (t - tFadeStart) / (totalDuration - tFadeStart);
    return lerp(1.0, 0.0, fadeProg);
  };

  const times = rawTimestamps.map((t) => Number((t / totalDuration).toFixed(4)));
  const scaleKeyframes = rawTimestamps.map((t) => Number(scaleAt(t).toFixed(3)));
  const yKeyframes = rawTimestamps.map((t) => Number(yAt(t).toFixed(2)));
  const opacityKeyframes = rawTimestamps.map((t) => Number(opacityAt(t).toFixed(3)));

  return {
    initial: { y: 0, opacity: 1, scale: 0.5 },
    animate: {
      scale: scaleKeyframes,
      y: yKeyframes,
      opacity: opacityKeyframes,
      transition: {
        duration: totalDuration,
        times,
        ease: "linear" as const,
      },
    },
  };
})();

export function CombatTextRail({ bursts }: { bursts: CombatTextBurst[] }) {
  const reducedMotion = useReducedMotion();
  const staticMotion = reducedMotion === true || isAnimationDisabled();
  const newestRef = useRef<HTMLDivElement>(null);
  const [newestHeight, setNewestHeight] = useState(0);
  const newestId = bursts.at(-1)?.id;

  useLayoutEffect(() => {
    const newest = newestRef.current;
    if (!newest) return;
    const measure = () => setNewestHeight(newest.offsetHeight);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(newest);
    return () => observer?.disconnect();
  }, [newestId]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 w-full">
      <div
        className="absolute inset-x-0 flex -translate-y-full flex-col items-center gap-3"
        style={{ top: "calc(50% - 3rem)", marginTop: newestHeight }}
      >
        <AnimatePresence mode="popLayout">
          {bursts.map((burst) => (
            <motion.div
              key={burst.id}
              ref={burst.id === newestId ? newestRef : undefined}
              layout={staticMotion ? false : "position"}
              data-testid="combat-text-burst"
              data-burst-id={burst.id}
              data-target={burst.target}
              className="relative w-max max-w-full shrink-0"
              initial={false}
              exit={{ opacity: 0, transition: { duration: staticMotion ? 0 : 0.1 } }}
              transition={{ layout: { duration: 0.15, ease: "easeOut" } }}
            >
              <motion.div
                className={cn(
                  "grid justify-items-center gap-x-4 gap-y-1 font-bold tracking-wide",
                  "transform-gpu will-change-transform [backface-visibility:hidden]",
                  "[filter:drop-shadow(0_0_1px_rgb(0,0,0))_drop-shadow(0_1px_2px_rgba(0,0,0,0.95))]",
                  burst.entries.filter((entry) => entry.kind !== "notice").length > 3 && "grid-cols-2",
                )}
                style={{ fontSize: `calc(${FCT_BASE_SIZE_CQH * 10.8}px * var(--content-scale, 1))` }}
                initial={staticMotion ? false : FCT_ANIMATION_PROPS.initial}
                animate={staticMotion ? { opacity: 1, scale: 1, y: 0 } : FCT_ANIMATION_PROPS.animate}
              >
                {burst.entries.map((entry) => (
                  <CombatTextEntry key={entry.id} entry={entry} />
                ))}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CombatTextEntry({ entry }: { entry: FloatingCombatText }) {
  const icon = getCombatTextIcon(entry);
  return (
    <div
      data-testid="combat-text"
      data-kind={entry.kind}
      data-stat={entry.stat}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
        entry.kind === "notice" && "col-span-full",
        getCombatTextColorClass(entry),
      )}
    >
      {icon
        ? createElement(icon, {
            style: {
              width: `calc(${FCT_BASE_SIZE_CQH * 0.94 * 10.8}px * var(--content-scale, 1))`,
              height: `calc(${FCT_BASE_SIZE_CQH * 0.94 * 10.8}px * var(--content-scale, 1))`,
            },
            strokeWidth: 3,
          })
        : null}
      {entry.displayText ? (
        <span style={{ WebkitTextStroke: "1.5px rgba(0, 0, 0, 0.95)", paintOrder: "stroke fill" }}>
          {entry.displayText}
        </span>
      ) : null}
    </div>
  );
}
