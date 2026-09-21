import { useEffect, useRef, useState } from "react";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { startDriftingLights } from "@/lib/animation/drifting-lights";
import type { BackgroundLightsSettings } from "@/lib/screen-effect-settings";
import { cn } from "@/lib/utils";

export function DriftingLights({ strength, motion }: Pick<BackgroundLightsSettings, "strength" | "motion">) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof startDriftingLights> | null>(null);
  const [available, setAvailable] = useState(true);
  const reduced = useReducedMotionPreference();

  useEffect(() => {
    if (!canvas.current) return;
    const instance = startDriftingLights(canvas.current, setAvailable);
    renderer.current = instance;
    return () => {
      instance.dispose();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    renderer.current?.update({ strength, motion: reduced ? "still" : motion });
  }, [strength, motion, reduced]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "screen-effect-layer",
        "screen-effect-lights",
        "pointer-events-none",
        !available && "screen-effect-lights-fallback",
      )}
      style={{ opacity: available ? 1 : strength / 100 }}
    >
      <canvas
        ref={canvas}
        data-testid="drifting-lights-canvas"
        className="absolute inset-0"
        style={{ visibility: available ? "visible" : "hidden" }}
      />
    </div>
  );
}
