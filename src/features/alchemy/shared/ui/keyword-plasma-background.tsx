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

function usePlasmaColorLerp(target: PlasmaColorPair | null): { current: PlasmaColorState } {
  const targetPrimary = target?.primary ?? null;
  const targetSecondary = target?.secondary ?? null;
  const colorsRef = useRef<PlasmaColorState>(
    targetPrimary && targetSecondary
      ? { primary: targetPrimary, secondary: targetSecondary }
      : { primary: "#000000", secondary: "#000000" },
  );
  const targetRef = useRef<{ primary: string; secondary: string } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!targetPrimary || !targetSecondary) {
      targetRef.current = null;
      return;
    }
    const currentTarget = { primary: targetPrimary, secondary: targetSecondary };
    targetRef.current = currentTarget;

    const from = { ...colorsRef.current };
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
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [targetPrimary, targetSecondary]);

  return colorsRef;
}

export function KeywordPlasmaBackground({
  keywordIds,
  renderer = "canvas",
  focalYOffset = 75,
  active = true,
  className,
}: {
  keywordIds: readonly KeywordId[];
  renderer?: PlasmaRendererMode;
  focalYOffset?: number;
  active?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorPair = getPlasmaColorPair(keywordIds);
  const colorsRef = usePlasmaColorLerp(colorPair);
  const hasColorPair = Boolean(colorPair);

  // Color transitions mutate colorsRef; do not restart the renderer on hover.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (isAnimationDisabled() || !hasColorPair) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const stop = startKeywordPlasma(renderer, {
      canvas,
      colorsRef,
      focalYOffset,
      active,
    });

    return () => stop();
  }, [renderer, focalYOffset, active, hasColorPair, colorsRef]);

  if (!colorPair) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 mix-blend-plus-lighter", className)}
    />
  );
}
