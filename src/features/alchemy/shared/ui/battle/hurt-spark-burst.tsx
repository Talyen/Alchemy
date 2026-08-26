// Canvas spark burst around a combatant portrait, colored by the resolved impact event.
// Depends on hurt-sparks animation helpers and game timing constants.
// Used by PortraitHurtVfx during each hurt pulse.
import { useLayoutEffect, useRef } from "react";

import { animateHurtSparks, createHurtSparks } from "@/lib/animation/hurt-sparks";
import { HURT_SPARK_COUNT, HURT_SPARK_DURATION_MS } from "@/lib/game-constants";

const HURT_SPARK_BURST_CONFIG = {
  canvasScale: 2,
} as const;

export function HurtSparkBurst({ flashToken, colors }: { flashToken: number; colors: readonly string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (flashToken <= 0) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w === 0 || h === 0) return;

    const cw = w * HURT_SPARK_BURST_CONFIG.canvasScale;
    const ch = h * HURT_SPARK_BURST_CONFIG.canvasScale;
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const artX = (cw - w) / 2;
    const artY = (ch - h) / 2;
    const particles = createHurtSparks(cw, ch, HURT_SPARK_COUNT, colors, {
      x: artX,
      y: artY,
      width: w,
      height: h,
    });
    const stop = animateHurtSparks(ctx, particles, cw, ch, HURT_SPARK_DURATION_MS, () => {});

    return () => {
      stop();
    };
  }, [colors, flashToken]);

  return (
    <canvas ref={canvasRef} className="pointer-events-none absolute -top-[50%] -left-[50%] z-30 h-[200%] w-[200%]" />
  );
}
