import { useGameTranslation } from "@/components/use-game-translation";

import { createElement, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { clamp01, cn } from "@/lib/utils";
import { COMBAT_TEXT_BASE_SIZE_PX, COMBAT_TEXT_MAX_BURSTS_PER_RAIL } from "@/lib/game-constants";

import { ReactionTextRail } from "./reaction-text";
import type { CombatTextBurst, FloatingCombatText, ReactionAnnouncement } from "../../../../shared/types";
import {
  getCombatTextColorClass,
  getCombatTextIcon,
  getCombatTextLeadingIcon,
  getCombatTextAccessibleLabel,
} from "../../../../shared/utils/index";

const FCT_POP_SCALE = 2.0;
const FCT_HOLD_SCALE = 1.8;
const FCT_POP_DURATION = 0.2;
const FCT_HOLD_DURATION = 0.2;
const FCT_SHRINK_DURATION = 0.5;
const FCT_RISE_DURATION = 0.7;
const FCT_RISE_DISTANCE_PX = 240;
const FCT_FADE_DURATION = 0.25;

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

  const lerp = (start: number, end: number, progress: number) => start + (end - start) * clamp01(progress);

  const getRiseEaseIn = (p: number) => Math.pow(clamp01(p), 3);

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

const { y: FLOAT_Y, ...NUMERIC_ANIMATION } = FCT_ANIMATION_PROPS.animate;
const FLOAT_ANIMATION = { y: FLOAT_Y, transition: NUMERIC_ANIMATION.transition };
const FLOAT_STATIC = { y: 0 };

export function CombatTextRail({
  bursts,
  reactions = [],
}: {
  bursts: CombatTextBurst[];
  reactions?: ReactionAnnouncement[];
}) {
  useGameTranslation();
  const reducedMotion = useReducedMotion();
  const staticMotion = reducedMotion === true || isAnimationDisabled();
  const newestRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [positioned, setPositioned] = useState(false);
  const [newestHeight, setNewestHeight] = useState(0);
  const groups: Array<{ id: string; firstShownAt: number; burst?: CombatTextBurst; reaction?: ReactionAnnouncement }> =
    bursts.map((burst) => ({ id: burst.id, firstShownAt: burst.firstShownAt, burst }));
  for (const reaction of reactions) {
    const group = groups.find((entry) => entry.id === reaction.burstId);
    if (group) group.reaction = reaction;
    else groups.push({ id: reaction.burstId, firstShownAt: reaction.firstShownAt, reaction });
  }
  groups.sort((a, b) => a.firstShownAt - b.firstShownAt);
  const visibleGroups = groups.slice(-COMBAT_TEXT_MAX_BURSTS_PER_RAIL);
  const newestId = visibleGroups.at(-1)?.id;

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let readyFrame: number | null = null;
    const fit = () => {
      const layer = rail.parentElement?.parentElement;
      if (!layer || layer.style.visibility !== "visible" || rail.offsetHeight <= 0) return;
      const bounds = layer.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      // Keep a rapid sequence readable inside the viewport, reserving its visible upward travel.
      const available = bounds.top + bounds.height / 2 - 3 * Number.parseFloat(getComputedStyle(rail).fontSize) - 92;
      const scale = Math.min(1, Math.max(0.1, available / rail.offsetHeight));
      setFitScale((previous) => (Math.abs(scale - previous) < 0.001 ? previous : scale));
      if (!positioned) {
        if (readyFrame !== null) cancelAnimationFrame(readyFrame);
        readyFrame = requestAnimationFrame(() => setPositioned(true));
      }
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(rail);
    if (rail.parentElement?.parentElement) observer?.observe(rail.parentElement.parentElement);
    return () => {
      observer?.disconnect();
      if (readyFrame !== null) cancelAnimationFrame(readyFrame);
    };
  }, [bursts, reactions, positioned]);

  useLayoutEffect(() => {
    const newest = newestRef.current;
    if (!newest) return;
    const measure = () =>
      setNewestHeight((previous) => (newest.offsetHeight === previous ? previous : newest.offsetHeight));
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(newest);
    return () => observer?.disconnect();
  }, [newestId]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 w-full">
      <div
        ref={railRef}
        className="absolute inset-x-0 flex origin-bottom flex-col items-center gap-3 will-change-transform"
        style={{
          visibility: positioned ? "visible" : "hidden",
          top: "calc(50% - 3rem)",
          transform: `translate3d(0, calc(-100% + ${(newestHeight * fitScale) / 2}px), 0) scale(${fitScale})`,
        }}
      >
        <AnimatePresence mode="popLayout">
          {visibleGroups.map((group) => (
            <motion.div
              key={group.id}
              ref={group.id === newestId ? newestRef : undefined}
              data-testid="combat-text-burst"
              data-burst-id={group.id}
              data-first-shown-at={group.firstShownAt}
              data-target={group.burst?.target ?? group.reaction?.target}
              className="relative w-full shrink-0"
              initial={false}
              exit={{ opacity: 0, transition: { duration: staticMotion ? 0 : 0.1 } }}
            >
              <motion.div
                data-testid="combat-feedback-action"
                className="flex w-full flex-col items-center gap-3"
                initial={staticMotion ? false : FLOAT_STATIC}
                animate={staticMotion ? FLOAT_STATIC : FLOAT_ANIMATION}
              >
                {group.reaction && <ReactionTextRail announcements={[group.reaction]} />}
                <CombatNumbers burst={group.burst} staticMotion={staticMotion} />
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CombatNumbers({ burst, staticMotion }: { burst: CombatTextBurst | undefined; staticMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [fontSize, setFontSize] = useState<number | undefined>();
  const numericCount = burst?.entries.filter((entry) => entry.kind !== "notice").length ?? 0;
  const noticeCount = (burst?.entries.length ?? 0) - numericCount;
  const rows = noticeCount + (numericCount > 3 ? Math.ceil(numericCount / 2) : numericCount);
  // Reserve the first frame before font measurement, avoiding a zero-height jump.
  const initialHeight = `calc(${rows * COMBAT_TEXT_BASE_SIZE_PX * 1.5 * FCT_POP_SCALE}px * var(--content-scale, 1) + ${Math.max(0, rows - 1) * 4 * FCT_POP_SCALE}px)`;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !burst) return;
    const measure = () => {
      const parent = node.parentElement;
      const width = parent?.clientWidth ?? 0;
      if (parent && width > 0 && node.scrollWidth > 0) {
        const base = Number.parseFloat(getComputedStyle(parent).fontSize);
        const current = Number.parseFloat(getComputedStyle(node).fontSize);
        const fitted = Math.min(base, ((current * width) / (node.scrollWidth * FCT_POP_SCALE)) * 0.98);
        setFontSize((previous) => (previous !== undefined && Math.abs(previous - fitted) < 0.2 ? previous : fitted));
      }
      setHeight((previous) => (previous === node.offsetHeight ? previous : node.offsetHeight));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    if (node.parentElement) observer?.observe(node.parentElement);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => {
      observer?.disconnect();
      document.fonts?.removeEventListener("loadingdone", measure);
    };
  }, [burst]);
  return (
    <div
      className="relative flex w-full items-center justify-center"
      style={{
        height: height > 0 ? height * FCT_POP_SCALE : initialHeight,
        fontSize: `calc(${COMBAT_TEXT_BASE_SIZE_PX}px * var(--content-scale, 1))`,
      }}
    >
      {burst && (
        <motion.div
          ref={ref}
          className={cn(
            "grid w-max justify-items-center gap-x-4 gap-y-1 font-bold tracking-wide",
            "transform-gpu will-change-transform [backface-visibility:hidden]",
            "[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.95))]",
            burst.entries.filter((entry) => entry.kind !== "notice").length > 3 && "grid-cols-2",
          )}
          style={{ fontSize: fontSize ?? "inherit" }}
          initial={staticMotion ? false : { opacity: 1, scale: 0.5 }}
          animate={staticMotion ? { opacity: 1, scale: 1 } : NUMERIC_ANIMATION}
        >
          {burst.entries.map((entry) => (
            <CombatTextEntry key={entry.id} entry={entry} staticMotion={staticMotion} />
          ))}
        </motion.div>
      )}
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
      aria-label={i18n.displayText(i18n.read(() => getCombatTextAccessibleLabel(entry)))}
      data-kind={entry.kind}
      data-stat={entry.stat}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
        entry.kind === "notice" && "col-span-full",
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
              style: { width: "0.94em", height: "0.94em" },
              strokeWidth: 3,
            })
          : null,
      )}
      {i18n.displayText(
        icon
          ? createElement(icon, {
              style: {
                width: "0.94em",
                height: "0.94em",
              },
              strokeWidth: 3,
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
