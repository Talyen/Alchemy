import { useEffect, useRef, useState } from "react";
import { clamp01, cn } from "@/lib/utils";
import {
  getPlasmaColorPair,
  parsePlasmaHexColor,
  type PlasmaColorPair,
} from "@/features/alchemy/shared/config/plasma-palettes";
import type { KeywordId } from "@/features/alchemy/shared/config/game-data-catalog";
import { shouldReduceMotion } from "@/lib/animation/animation-prefs";
import { startKeywordPlasma, type PlasmaColorState } from "@/lib/animation/keyword-plasma";
import { lerpParsedRgbFloats } from "@/lib/animation/plasma-colors";

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
  const motionAllowed = !shouldReduceMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorPair =
    explicitColorPair !== undefined ? explicitColorPair : keywordIds ? getPlasmaColorPair(keywordIds) : null;
  const hasColorPair = colorPair !== null;
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
      activeRef.current = hasColorPair;
      return;
    }
    const from = { ...colorsRef.current };
    if (from.primary === targetPrimary && from.secondary === targetSecondary) {
      activeRef.current = hasColorPair;
      if (hasColorPair) wakeRef.current();
      return;
    }
    activeRef.current = true;
    wakeRef.current();

    const start = performance.now();
    // Interrupted fades need owned starting tuples; the previous fade's output
    // is mutable, and must never become the next fade's working buffer.
    const fromPrimary =
      typeof from.primary === "string"
        ? parsePlasmaHexColor(from.primary)
        : ([...from.primary] as [number, number, number]);
    const fromSecondary =
      typeof from.secondary === "string"
        ? parsePlasmaHexColor(from.secondary)
        : ([...from.secondary] as [number, number, number]);
    const mixedPrimary: [number, number, number] = [0, 0, 0];
    const mixedSecondary: [number, number, number] = [0, 0, 0];
    const mixedColors: PlasmaColorState = { primary: mixedPrimary, secondary: mixedSecondary };
    let cachedTarget: PlasmaColorPair | null = null;
    let toPrimary = parsePlasmaHexColor(currentTarget.primary);
    let toSecondary = parsePlasmaHexColor(currentTarget.secondary);

    function tick(now: number) {
      const activeTarget = targetRef.current;
      if (!activeTarget) return;

      if (cachedTarget !== activeTarget) {
        cachedTarget = activeTarget;
        toPrimary = parsePlasmaHexColor(activeTarget.primary);
        toSecondary = parsePlasmaHexColor(activeTarget.secondary);
      }

      const t = Math.min(1, (now - start) / COLOR_LERP_MS);
      lerpParsedRgbFloats(fromPrimary, toPrimary, t, mixedPrimary);
      lerpParsedRgbFloats(fromSecondary, toSecondary, t, mixedSecondary);
      colorsRef.current = mixedColors;

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!hasColorPair) {
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
  }, [hasColorPair, targetPrimary, targetSecondary, motionAllowed, visible, active, webglAvailable]);

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
