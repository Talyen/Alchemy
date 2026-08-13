import { useEffect, useState } from "react";

import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS } from "@/lib/game-constants";

export type FadePhase = "enter" | "exit" | "idle";

export function fadePhaseClass(phase: FadePhase): string | undefined {
  if (phase === "exit") return "screen-fade-out";
  if (phase === "enter") return "screen-fade-in";
  return undefined;
}

export function useHeldWhile<T>(hold: boolean, value: T): T {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    if (!hold) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- snapshot the last live value so outro can keep rendering it
    setHeld(value);
  }, [hold, value]);
  return hold ? value : held;
}

export function useFadePresence(open: boolean): { mounted: boolean; phase: "enter" | "exit" } {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<"enter" | "exit">(open ? "enter" : "exit");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- presence mounts and plays enter when open becomes true
      setMounted(true);
      setPhase("enter");
      return;
    }
    if (!mounted) return;
    setPhase("exit");
    const timeout = window.setTimeout(() => setMounted(false), resolveGameDelay(MOTION_FADE_MS));
    return () => window.clearTimeout(timeout);
  }, [open, mounted]);

  return { mounted, phase };
}
