// Eased HP counter for campfire / wildwood recovery heal animations.
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
  const frameRef = useRef<number | null>(null);
  const onFinishedRef = useRef(onFinished);
  const inactiveFrom = active ? null : from;

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  // When inactive, mirror `from` without an effect setState (key off inactiveFrom).
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

      function animate() {
        const progress = Math.min(1, (performance.now() - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayHealth(Math.round(from + (to - from) * eased));
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
