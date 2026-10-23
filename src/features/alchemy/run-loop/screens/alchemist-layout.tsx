import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { GoldDisplay } from "../../shared/ui/display-elements";

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
  const reducedMotion = useReducedMotionPreference();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion) return;
    let height = element.offsetHeight;
    let animation: Animation | undefined;
    const observer = new ResizeObserver(() => {
      const next = element.offsetHeight;
      const displacement = (next - height) / 2;
      height = next;
      if (!displacement) return;
      animation?.cancel();
      animation = element.animate?.([{ transform: `translateY(${displacement}px)` }, { transform: "translateY(0)" }], {
        duration: 220,
        easing: "cubic-bezier(.2,.8,.2,1)",
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      animation?.cancel();
    };
  }, [reducedMotion]);
  return (
    <div className="relative h-full w-full overflow-hidden">
      <PageLayout>
        <div ref={ref} className="w-full">
          <ScreenShell className="relative z-10">
            <ScreenHeaderRow title={title} trailing={<GoldDisplay gold={gold} />} onBack={onBack} />
            <div className="mt-6 flex flex-col items-center gap-6 text-center">{children}</div>
          </ScreenShell>
        </div>
      </PageLayout>
    </div>
  );
}
