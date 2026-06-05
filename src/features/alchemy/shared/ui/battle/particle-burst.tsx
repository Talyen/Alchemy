// Canvas particle breakup effect for dead actor art.
// Depends on particle animation helpers and direct canvas/image APIs.
// Used by ArtPanel when an actor death should dissolve the card image.
import { useLayoutEffect, useRef } from "react";

import { animateParticles, createParticles } from "@/lib/animation/particle-burst";

const PARTICLE_BURST_CONFIG = {
  canvasScale: 2,
  durationMs: 2400,
} as const;

export function ParticleBurst({ imageUrl }: { imageUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    // The actor image is sampled into canvas particles, then the canvas is cleared before
    // animation so CSS frame fade and particle breakup read as one death effect.
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w === 0 || h === 0) return;

    const cw = w * PARTICLE_BURST_CONFIG.canvasScale;
    const ch = h * PARTICLE_BURST_CONFIG.canvasScale;
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    let cancelled = false;
    let stop: (() => void) | null = null;

    img.onload = () => {
      if (cancelled) return;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      const particles = createParticles(ctx, cw, ch);
      ctx.clearRect(0, 0, cw, ch);
      stop = animateParticles(ctx, particles, cw, ch, PARTICLE_BURST_CONFIG.durationMs, () => {});
    };

    img.onerror = () => {
      // If the image fails to load, do nothing; the CSS fade still handles the death animation.
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
      if (stop) stop();
    };
  }, [imageUrl]);

  return (
    <canvas ref={canvasRef} className="pointer-events-none absolute z-10 h-[200%] w-[200%] -left-[50%] -top-[50%]" />
  );
}
