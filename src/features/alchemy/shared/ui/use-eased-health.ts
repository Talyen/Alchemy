// Eased HP counter for campfire heal animations.
import { useEffect, useRef, useState } from "react";

import { CAMPFIRE_ANIMATION_MS } from "@/lib/game-constants";

export function useEasedHealth({
  from,
  to,
  active,
  durationMs = CAMPFIRE_ANIMATION_MS,
  onFinished,
}: {
  from: number;
  to: number;
  active: boolean;
  durationMs?: number;
  onFinished?: () => void;
}) {
  const [displayHealth, setDisplayHealth] = useState(from);
  const [progressTarget, setProgressTarget] = useState(from);
  const [syncedInput, setSyncedInput] = useState({ active, from });
  const frameRef = useRef<number | null>(null);
  const onFinishedRef = useRef(onFinished);
  const inactiveFrom = active ? null : from;

  // Adjust animation state during render when its origin changes. React retries this
  // render before committing, so activation cannot paint a stale previous origin.
  if (syncedInput.active !== active || syncedInput.from !== from) {
    setSyncedInput({ active, from });
    setDisplayHealth(from);
    setProgressTarget(from);
  }

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const shownHealth = inactiveFrom ?? displayHealth;
  const shownProgress = inactiveFrom ?? progressTarget;

  useEffect(() => {
    if (!active) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      const startTime = performance.now();
      setProgressTarget(to);
      setDisplayHealth(from);

      let lastDispatched = from;
      function animate() {
        const progress = Math.min(1, (performance.now() - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        const nextValue = Math.round(from + (to - from) * eased);
        if (nextValue !== lastDispatched) {
          lastDispatched = nextValue;
          setDisplayHealth(nextValue);
        }
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        } else {
          frameRef.current = null;
          onFinishedRef.current?.();
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    });

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [active, durationMs, from, to]);

  return { displayHealth: shownHealth, progressTarget: shownProgress };
}
