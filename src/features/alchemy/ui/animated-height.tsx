// Height-transition wrapper for swapping screen sections without layout jumps.
// Depends only on React and direct DOM height measurement.
// Used by alchemy UI where content changes size but should animate smoothly.
import { useRef, useLayoutEffect, type ReactNode } from "react";

const ANIMATED_HEIGHT_CONFIG = {
  durationMs: 250,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  minHeightDeltaPx: 2,
} as const;

export function AnimatedHeight({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prevHeight = useRef(0);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    // Store previous scrollHeight, force one reflow, then animate to the new height.
    const el = ref.current;
    if (!el) return;

    const newHeight = el.scrollHeight;

    if (
      mounted.current &&
      prevHeight.current > 0 &&
      Math.abs(prevHeight.current - newHeight) > ANIMATED_HEIGHT_CONFIG.minHeightDeltaPx
    ) {
      el.style.overflow = "hidden";
      el.style.height = `${prevHeight.current}px`;
      // Force the browser to commit the old height before transitioning to the new one.
      void el.scrollHeight;

      el.style.transition = `height ${ANIMATED_HEIGHT_CONFIG.durationMs}ms ${ANIMATED_HEIGHT_CONFIG.easing}`;
      el.style.height = `${newHeight}px`;

      const onEnd = (event: TransitionEvent) => {
        if (event.target !== el || event.propertyName !== "height") return;

        el.style.height = "";
        el.style.overflow = "";
        el.style.transition = "";
        el.removeEventListener("transitionend", onEnd);
      };
      el.addEventListener("transitionend", onEnd);
    }

    prevHeight.current = newHeight;
    mounted.current = true;
  });

  return <div ref={ref}>{children}</div>;
}
