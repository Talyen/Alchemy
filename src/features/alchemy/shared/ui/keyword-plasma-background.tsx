import { useEffect, useRef, useState } from "react";
import { clamp01, cn } from "@/lib/utils";
import {
  getPlasmaColorPair,
  lerpParsedPlasmaColor,
  parsePlasmaHexColor,
  type PlasmaColorPair,
} from "@/features/alchemy/shared/config/plasma-palettes";
import type { KeywordId } from "@/features/alchemy/shared/config/game-data-catalog";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { startKeywordPlasma, type PlasmaColorState } from "@/lib/animation/keyword-plasma";

const COLOR_LERP_MS = 400;

const BLACK_PAIR: PlasmaColorPair = { primary: "#000000", secondary: "#000000" };

export function KeywordPlasmaBackground({
  keywordIds,
  colorPair: explicitColorPair,
  focalYOffset = 0,
  active = true,
  className,
  intensity = 100,
}: {
  keywordIds?: readonly KeywordId[] | null | undefined;
  colorPair?: PlasmaColorPair | null | undefined;
  focalYOffset?: number | undefined;
  active?: boolean | undefined;
  className?: string | undefined;
  intensity?: number | undefined;
}) {
  const [webglAvailable, setWebglAvailable] = useState(true);
  const visible = intensity > 0;
  const motionAllowed =
    !isAnimationDisabled() &&
    (typeof window.matchMedia !== "function" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
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

    if (!motionAllowed || !visible || !active || !webglAvailable) {
      colorsRef.current = currentTarget;
      activeRef.current = colorPair !== null;
      return;
    }
    const from = { ...colorsRef.current };
    if (from.primary === targetPrimary && from.secondary === targetSecondary) {
      activeRef.current = colorPair !== null;
      if (colorPair !== null) wakeRef.current();
      return;
    }
    activeRef.current = true;
    wakeRef.current();

    const start = performance.now();
    const fromPrimary = parsePlasmaHexColor(from.primary);
    const fromSecondary = parsePlasmaHexColor(from.secondary);

    function tick(now: number) {
      const activeTarget = targetRef.current;
      if (!activeTarget) return;

      const t = Math.min(1, (now - start) / COLOR_LERP_MS);
      colorsRef.current = {
        primary: lerpParsedPlasmaColor(fromPrimary, parsePlasmaHexColor(activeTarget.primary), t),
        secondary: lerpParsedPlasmaColor(fromSecondary, parsePlasmaHexColor(activeTarget.secondary), t),
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
  }, [colorPair, targetPrimary, targetSecondary, motionAllowed, visible, active, webglAvailable]);

  useEffect(() => {
    if (!motionAllowed || !visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const stop = startKeywordPlasma({
      canvas,
      onAvailabilityChange: setWebglAvailable,
      colorsRef,
      focalYOffset,
      active: () => active && activeRef.current,
      onWakeReady: (wake) => {
        wakeRef.current = wake;
      },
    });

    return () => stop();
  }, [focalYOffset, active, motionAllowed, visible]);

  if (intensity <= 0) return null;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 mix-blend-plus-lighter", className)}
      style={{ opacity: clamp01(intensity / 100) }}
    >
      <canvas
        ref={canvasRef}
        data-testid="global-plasma-background"
        className="absolute inset-0"
        style={{ visibility: webglAvailable ? "visible" : "hidden" }}
      />
      {!webglAvailable && motionAllowed && active && colorPair !== null ? (
        <div
          data-testid="static-plasma-background"
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% calc(50% - ${focalYOffset}px), color-mix(in srgb, ${targetPrimary} 13%, transparent), color-mix(in srgb, ${targetSecondary} 7%, transparent) 35%, transparent 75%)`,
          }}
        />
      ) : null}
    </div>
  );
}
