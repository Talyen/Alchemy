import { useRef, useEffect, type ReactNode } from "react";

const DURATION = 250;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export function AnimatedHeight({ deps, children }: { deps: unknown[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prevHeight = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const newHeight = el.scrollHeight;

    if (mounted.current && prevHeight.current > 0 && prevHeight.current !== newHeight) {
      el.style.overflow = "hidden";
      el.style.height = `${prevHeight.current}px`;
      el.scrollHeight;

      el.style.transition = `height ${DURATION}ms ${EASE}`;
      el.style.height = `${newHeight}px`;

      const onEnd = () => {
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
