import { useLayoutEffect, useState, type ReactNode } from "react";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";

export function CollectionContentLayout({ children, pagination }: { children: ReactNode; pagination: ReactNode }) {
  const reducedMotion = useReducedMotionPreference();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    if (!container || !content || typeof ResizeObserver === "undefined") return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      // Computed heights are in local CSS units; bounding rectangles include
      // the virtual stage transform and would apply its scale a second time.
      const contentHeight = parseFloat(getComputedStyle(content).height);
      const footerHeight = footer ? parseFloat(getComputedStyle(footer).height) : 0;
      const gap = footer ? parseFloat(getComputedStyle(container).rowGap) : 0;
      const nextHeight = contentHeight + footerHeight + gap;
      if (Number.isFinite(nextHeight)) setHeight(nextHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    if (footer) observer.observe(footer);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [container, content, footer]);

  return (
    <div
      ref={setContainer}
      className="mt-6 flex flex-col items-center gap-4 overflow-visible"
      style={{ height, transition: reducedMotion ? "none" : "height 200ms ease-out" }}
    >
      <div className="min-h-0 w-full flex-1 overflow-visible">
        <div ref={setContent} className="w-full overflow-visible">
          {children}
        </div>
      </div>
      {pagination ? (
        <div ref={setFooter} className="flex shrink-0 flex-wrap items-center justify-center">
          {pagination}
        </div>
      ) : null}
    </div>
  );
}
