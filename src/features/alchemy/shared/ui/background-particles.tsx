import { useEffect, useRef } from "react";
import { shouldReduceMotion } from "@/lib/animation/animation-prefs";
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
    if (shouldReduceMotion()) return;

    const stop = startBackgroundParticles(canvasRef, variant, colors, alphaMultiplier, particleCount);

    return () => stop();
  }, [variant, colors, alphaMultiplier, particleCount]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0" />;
}
