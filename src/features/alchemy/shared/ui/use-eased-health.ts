import { useEffect, useState } from "react";
import { useLatestRef } from "./use-latest-ref";

import { CAMPFIRE_ANIMATION_MS } from "@/lib/game-constants";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { clamp01 } from "@/lib/math";

export function useEasedHealth({
  from,
  to,
  active,
  durationMs = CAMPFIRE_ANIMATION_MS,
  easing = "cubic",
  onFinished,
}: {
  from: number;
  to: number;
  active: boolean;
  durationMs?: number;
  easing?: "cubic" | "linear";
  onFinished?: () => void;
}) {
  const reducedMotion = useReducedMotionPreference();
  const animationDuration = reducedMotion ? 0 : durationMs;
  const [animatedHealth, setAnimatedHealth] = useState(from);
  const [syncedInput, setSyncedInput] = useState({ active, from });
  const onFinishedRef = useLatestRef(onFinished);

  if (syncedInput.active !== active || syncedInput.from !== from) {
    setSyncedInput({ active, from });
    setAnimatedHealth(from);
  }

  const shownHealth = active ? animatedHealth : from;

  useEffect(() => {
    if (!active) return;

    const startTime = performance.now();
    let frame: number | null = null;
    function animate(now: number) {
      const progress = animationDuration <= 0 ? 1 : clamp01((now - startTime) / animationDuration);
      const eased = easing === "linear" ? progress : 1 - Math.pow(1 - progress, 3);
      setAnimatedHealth(from + (to - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        frame = null;
        onFinishedRef.current?.();
      }
    }

    frame = requestAnimationFrame(animate);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [active, animationDuration, easing, from, to, onFinishedRef]);

  return { displayHealth: Math.round(shownHealth), progressHealth: shownHealth };
}
