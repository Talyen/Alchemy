// Fade primitive stack — see also `use-sequential-fade-swap.ts` (swap variant),
// `fade-slot.tsx` (FadeSlot wrapper), and `portaled-tooltip.tsx:64-70` (standalone
// tooltip fade — third implementation; TODO: extract to shared helper if fadeOutMs
// variant converges with this primitive).
import { useEffect, useState } from "react";

import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS } from "@/lib/game-constants";

export type FadePhase = "enter" | "exit" | "idle";

export function fadePhaseClass(phase: FadePhase): string | undefined {
  if (phase === "exit") return "screen-fade-out";
  if (phase === "enter") return "screen-fade-in";
  return undefined;
}

/**
 * Shared hold primitive for fade outros — snapshots `value` while `hold` is
 * true so the exiting view keeps rendering the last live content. Used by
 * presence/swap wrappers; prefer this over ad-hoc `useRef` held snapshots
 * when the held value is a render input.
 */
export function useHeldWhile<T>(hold: boolean, value: T): T {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    if (!hold) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- snapshot the last live value so outro can keep rendering it
    setHeld(value);
  }, [hold, value]);
  return hold ? value : held;
}

/**
 * Primitive mount/phase controller for a single boolean `open` flag.
 * `useSequentialFadeSwap` builds on the same phase/timeout pattern for keyed
 * swaps; `FadeSlot` wraps that swap. `portaled-tooltip.tsx` keeps a third,
 * inline fade (visible + fadeOutMs) — see TODO there.
 */
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
