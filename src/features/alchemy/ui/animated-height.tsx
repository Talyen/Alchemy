// Height-transition wrapper for swapping screen sections without layout jumps.
// Depends only on React and direct DOM height measurement.
// Used by alchemy UI where content changes size but should animate smoothly.
import { useRef, useLayoutEffect, type ReactNode } from "react";

const DURATION = 250;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const MIN_HEIGHT_DELTA = 2;

export function AnimatedHeight({ deps, children }: { deps: unknown[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prevHeight = useRef(0);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    // Store previous scrollHeight, force one reflow, then animate to the new height.
    // Callers own deps intentionally because only they know what content changes matter.
    const el = ref.current;
    if (!el) return;

    const newHeight = el.scrollHeight;

    if (mounted.current && prevHeight.current > 0 && Math.abs(prevHeight.current - newHeight) > MIN_HEIGHT_DELTA) {
      el.style.overflow = "hidden";
      el.style.height = `${prevHeight.current}px`;
      void el.scrollHeight;

      el.style.transition = `height ${DURATION}ms ${EASE}`;
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
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref}>{children}</div>;
}
