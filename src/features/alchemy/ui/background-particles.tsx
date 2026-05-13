import { useEffect, useRef } from "react";
import { startBackgroundParticles } from "@/lib/animation/background-particles";
import type { ParticleVariant } from "@/lib/animation/background-particles";

export function BackgroundParticles({ variant = "embers", colors, alphaMultiplier }: { variant?: ParticleVariant; colors?: readonly string[]; alphaMultiplier?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    const stop = startBackgroundParticles(canvasRef as React.MutableRefObject<HTMLCanvasElement | null>, variant, colors, alphaMultiplier);

    return () => stop();
  }, [variant, colors, alphaMultiplier]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />;
}
