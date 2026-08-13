// Keyword-colored spark burst from the left and right edges of a talent node.
import { useLayoutEffect, useRef } from "react";

import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { animateHurtSparks, createHurtSparks } from "@/lib/animation/hurt-sparks";
import { TALENT_UNLOCK_ANIMATION_MS, TALENT_UNLOCK_SPARK_COUNT } from "@/lib/game-constants";

const CANVAS_SCALE = 2;
const VERTICAL_EDGE_SPAWN = {
  edges: "vertical",
  minSpeed: 2.2,
  speedSpan: 4.2,
  minSize: 1.2,
  sizeSpan: 1.8,
  angleJitter: 0.35,
} as const;

function shouldSkipBurst(): boolean {
  if (isAnimationDisabled()) return true;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TalentUnlockBurst({ active, colors }: { active: boolean; colors: readonly string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (!active || colors.length === 0 || shouldSkipBurst()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w === 0 || h === 0) return;

    const cw = w * CANVAS_SCALE;
    const ch = h * CANVAS_SCALE;
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const artX = (cw - w) / 2;
    const artY = (ch - h) / 2;
    const particles = createHurtSparks(
      cw,
      ch,
      TALENT_UNLOCK_SPARK_COUNT,
      colors,
      {
        x: artX,
        y: artY,
        width: w,
        height: h,
      },
      VERTICAL_EDGE_SPAWN,
    );
    return animateHurtSparks(ctx, particles, cw, ch, TALENT_UNLOCK_ANIMATION_MS, () => {});
  }, [active, colors]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute -top-[50%] -left-[50%] z-30 h-[200%] w-[200%]"
    />
  );
}
