// Eased HP counter for campfire heal animations.
import { useEffect, useRef, useState } from "react";

import { CAMPFIRE_ANIMATION_MS } from "@/lib/game-constants";

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
  const [animatedHealth, setAnimatedHealth] = useState(from);
  const [syncedInput, setSyncedInput] = useState({ active, from });
  const frameRef = useRef<number | null>(null);
  const onFinishedRef = useRef(onFinished);
  const inactiveFrom = active ? null : from;

  // Adjust animation state during render when its origin changes. React retries this
  // render before committing, so activation cannot paint a stale previous origin.
  if (syncedInput.active !== active || syncedInput.from !== from) {
    setSyncedInput({ active, from });
    setAnimatedHealth(from);
  }

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const shownHealth = inactiveFrom ?? animatedHealth;

  useEffect(() => {
    if (!active) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    const startTime = performance.now();
    function animate(now: number) {
      const progress = Math.min(1, Math.max(0, (now - startTime) / durationMs));
      const eased = easing === "linear" ? progress : 1 - Math.pow(1 - progress, 3);
      setAnimatedHealth(from + (to - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        frameRef.current = null;
        onFinishedRef.current?.();
      }
    }

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [active, durationMs, easing, from, to]);

  return { displayHealth: Math.round(shownHealth), progressHealth: shownHealth };
}
