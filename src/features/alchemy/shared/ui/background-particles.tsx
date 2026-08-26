import { useEffect, useRef } from "react";
import { startBackgroundParticles } from "@/lib/animation/background-particles";
import type { ParticleVariant } from "@/lib/animation/background-particles";

export function BackgroundParticles({
  variant = "embers",
  colors,
  alphaMultiplier,
  particleCount,
}: {
  variant?: ParticleVariant;
  colors?: readonly string[];
  alphaMultiplier?: number;
  particleCount?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    const stop = startBackgroundParticles(canvasRef, variant, colors, alphaMultiplier, particleCount);

    return () => stop();
  }, [variant, colors, alphaMultiplier, particleCount]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0" />;
}
