import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  getPlasmaColorPair,
  lerpPlasmaColor,
  type PlasmaColorPair,
} from "@/features/alchemy/shared/config/plasma-palettes";
import type { KeywordId } from "@/features/alchemy/shared/config/game-data-catalog";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { startKeywordPlasma, type PlasmaColorState, type PlasmaRendererMode } from "@/lib/animation/keyword-plasma";

const COLOR_LERP_MS = 400;

const BLACK_PAIR: PlasmaColorPair = { primary: "#000000", secondary: "#000000" };

export function KeywordPlasmaBackground({
  keywordIds,
  colorPair: explicitColorPair,
  renderer = "webgl",
  focalYOffset = 0,
  active = true,
  className,
  intensity = 100,
}: {
  keywordIds?: readonly KeywordId[] | null | undefined;
  colorPair?: PlasmaColorPair | null | undefined;
  renderer?: PlasmaRendererMode | undefined;
  focalYOffset?: number | undefined;
  active?: boolean | undefined;
  className?: string | undefined;
  intensity?: number | undefined;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorPair =
    explicitColorPair !== undefined ? explicitColorPair : keywordIds ? getPlasmaColorPair(keywordIds) : null;
  const activePair = colorPair ?? BLACK_PAIR;
  const targetPrimary = activePair.primary;
  const targetSecondary = activePair.secondary;

  const colorsRef = useRef<PlasmaColorState>({
    primary: targetPrimary,
    secondary: targetSecondary,
  });
  const activeRef = useRef(colorPair !== null);
  const wakeRef = useRef<() => void>(() => {});
  const targetRef = useRef<PlasmaColorPair | null>(null);
  const rafRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const currentTarget = { primary: targetPrimary, secondary: targetSecondary };
    targetRef.current = currentTarget;
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);

    const from = { ...colorsRef.current };
    if (from.primary === targetPrimary && from.secondary === targetSecondary) {
      activeRef.current = colorPair !== null;
      if (colorPair !== null) wakeRef.current();
      return;
    }
    activeRef.current = true;
    wakeRef.current();

    const start = performance.now();

    function tick(now: number) {
      const activeTarget = targetRef.current;
      if (!activeTarget) return;

      const t = Math.min(1, (now - start) / COLOR_LERP_MS);
      colorsRef.current = {
        primary: lerpPlasmaColor(from.primary, activeTarget.primary, t),
        secondary: lerpPlasmaColor(from.secondary, activeTarget.secondary, t),
      };

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (colorPair === null) {
        idleTimerRef.current = window.setTimeout(() => {
          activeRef.current = false;
        }, 100);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    };
  }, [colorPair, targetPrimary, targetSecondary]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (isAnimationDisabled()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const stop = startKeywordPlasma(renderer, {
      canvas,
      colorsRef,
      focalYOffset,
      active: () => active && activeRef.current,
      onWakeReady: (wake) => {
        wakeRef.current = wake;
      },
    });

    return () => stop();
  }, [renderer, focalYOffset, active]);

  if (intensity <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-testid="global-plasma-background"
      className={cn("pointer-events-none absolute inset-0 mix-blend-plus-lighter", className)}
      style={{ opacity: Math.max(0, Math.min(1, intensity / 100)) }}
    />
  );
}
