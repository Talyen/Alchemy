// Floating combat text widgets for battle feedback.
// Used by BattleScreen actor rails.
import { createElement } from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

import type { FloatingCombatText } from "../../types";
import { getCombatTextColorClass, getCombatTextIcon } from "../../utils";

// Finalized Floating Combat Text design parameters.
const FCT_BASE_SIZE_CQH = 3.5;
const FCT_POP_SCALE = 2.0;
const FCT_HOLD_SCALE = 1.8;
const FCT_POP_DURATION = 0.2;
const FCT_HOLD_DURATION = 0.2;
const FCT_SHRINK_DURATION = 0.5;
const FCT_RISE_DURATION = 0.5;
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

// Renders a rail of active combat text bubbles, centered on actor art.
export function CombatTextRail({ entries }: { entries: FloatingCombatText[] }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none relative z-30 h-24 w-full">
      <AnimatePresence>
        {entries.map((entry) => (
          <CombatTextBubble key={entry.id} entry={entry} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function CombatTextBubble({ entry }: { entry: FloatingCombatText }) {
  const icon = getCombatTextIcon(entry);
  const colorClass = getCombatTextColorClass(entry);

  const fontSize = `${FCT_BASE_SIZE_CQH}cqh`;
  const iconSize = `${FCT_BASE_SIZE_CQH * 0.94}cqh`;

  return (
    <div
      className="absolute left-1/2"
      // Lane offset is per floating entry — static utilities can't encode the runtime stack index.
      // Horizontal center lives on this wrapper so Framer y/scale on the bubble do not fight CSS transform.
      style={{ top: `${entry.lane * 56}px`, transform: "translate3d(-50%, 0, 0)" }}
    >
      <motion.div
        className={cn(
          "inline-flex items-center gap-1.5 font-bold tracking-wide whitespace-nowrap",
          "transform-gpu will-change-transform [backface-visibility:hidden]",
          "[filter:drop-shadow(0_0_1.5px_rgba(0,0,0,0.95))_drop-shadow(0_2px_4px_rgba(0,0,0,0.85))]",
          colorClass,
        )}
        style={{ fontSize }}
        {...FCT_ANIMATION_PROPS}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
      >
        {createElement(icon!, {
          style: { width: iconSize, height: iconSize },
          strokeWidth: 2.75,
        })}
        <span>{entry.displayText}</span>
      </motion.div>
    </div>
  );
}
