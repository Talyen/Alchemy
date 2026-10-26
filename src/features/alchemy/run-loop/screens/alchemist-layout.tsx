import { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { GoldDisplay } from "../../shared/ui/display-elements";
import { chooserRowShellWidthClass } from "../../shared/config";
import { cn } from "@/lib/utils";

/** Animate the centered stack's displacement without reserving empty screen space. */
export function AlchemistLayout({
  title,
  gold,
  onBack,
  children,
}: {
  title: string;
  gold: number;
  onBack?: (() => void) | undefined;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const height = useRef<number | null>(null);
  const animation = useRef<Animation | undefined>(undefined);
  const reducedMotion = useReducedMotionPreference();
  const updateLayout = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const scale = element.offsetWidth > 0 ? bounds.width / element.offsetWidth : 1;
    const next = bounds.height / scale;
    const page = element.closest<HTMLElement>(".game-page-scroll");
    const padding = page ? getComputedStyle(page) : null;
    const available =
      page && padding ? page.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom) : next;
    const displacement =
      height.current === null ? 0 : (Math.max(0, available - height.current) - Math.max(0, available - next)) / 2;
    height.current = next;
    if (reducedMotion) {
      animation.current?.cancel();
      return;
    }
    if (!displacement || !element.animate) return;
    // Preserve the current visual position when another navigation interrupts the ease.
    const transform = getComputedStyle(element).transform;
    const offset = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
    animation.current?.cancel();
    animation.current = element.animate?.(
      [{ transform: `translateY(${offset + displacement}px)` }, { transform: "translateY(0)" }],
      { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }, [reducedMotion]);
  useLayoutEffect(() => {
    updateLayout();
  });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion) return;
    const observer = new ResizeObserver(updateLayout);
    observer.observe(element);
    return () => {
      observer.disconnect();
      animation.current?.cancel();
    };
  }, [reducedMotion, updateLayout]);
  return (
    <div className="relative h-full w-full overflow-hidden">
      <PageLayout>
        <div ref={ref} className="w-full">
          <ScreenShell className={cn("relative z-10", chooserRowShellWidthClass)}>
            <ScreenHeaderRow title={title} trailing={<GoldDisplay gold={gold} />} onBack={onBack} />
            <div className="mt-6 flex flex-col items-center gap-6 text-center">{children}</div>
          </ScreenShell>
        </div>
      </PageLayout>
    </div>
  );
}
