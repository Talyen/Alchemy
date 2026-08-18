import { useEffect, useRef, useState } from "react";

import { resolveGameDelay } from "@/lib/animation/game-timer";

import type { FadePhase } from "./fade-presence";

export function useSequentialFadeSwap<T>({
  target,
  durationMs,
  initialPhase = "idle",
  onSwap,
}: {
  target: T;
  durationMs: number;
  initialPhase?: FadePhase;
  onSwap?: () => void;
}): { shown: T; phase: FadePhase } {
  const [shown, setShown] = useState(target);
  const [phase, setPhase] = useState<FadePhase>(initialPhase);
  const onSwapRef = useRef(onSwap);
  // eslint-disable-next-line react-hooks/refs -- latest onSwap; not a render input
  onSwapRef.current = onSwap;

  useEffect(() => {
    if (Object.is(target, shown)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cancelled swap must not leave the view on fade-out
      setPhase((current) => (current === "exit" ? "enter" : current));
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sequential fade-out before swapping identity
    setPhase("exit");
    const timeout = window.setTimeout(() => {
      onSwapRef.current?.();
      setShown(target);
      setPhase("enter");
    }, resolveGameDelay(durationMs));
    return () => window.clearTimeout(timeout);
  }, [target, shown, durationMs]);

  return { shown, phase };
}
