import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { DOUBLE_CLICK_FLYOVER_MS, MAGNET_RELEASE_EASE_MS } from "./drag-constants";
import type { DragRect } from "./use-board-drag";

export interface DragVisualBase {
  source: DragRect;
  rect: DragRect;
  releaseRect?: DragRect | undefined;
  settling?: boolean | undefined;
  releasing?: boolean | undefined;
  flyover?: boolean | undefined;
}

export function DragVisualPortal({
  visual,
  testId = "armory-gear-drag-visual",
  completeOnFlyover = false,
  className,
  children,
  onComplete,
}: {
  visual: DragVisualBase;
  testId?: string;
  completeOnFlyover?: boolean;
  className?: string;
  children: ReactNode;
  onComplete: () => void;
}) {
  const isDrag = !visual.settling && !visual.releasing && !visual.flyover;
  const startRect = visual.source;
  const releaseLeft = Math.round(visual.releaseRect?.left ?? visual.rect.left);
  const releaseTop = Math.round(visual.releaseRect?.top ?? visual.rect.top);
  const releaseWidth = Math.round(visual.releaseRect?.width ?? startRect.width);
  const releaseHeight = Math.round(visual.releaseRect?.height ?? startRect.height);
  const destinationLeft = Math.round(visual.rect.left);
  const destinationTop = Math.round(visual.rect.top);
  const destinationWidth = Math.round(visual.rect.width);
  const destinationHeight = Math.round(visual.rect.height);

  return createPortal(
    <motion.div
      key={isDrag ? "drag" : "settle"}
      data-testid={testId}
      className={cn("pointer-events-none fixed z-[120] overflow-hidden rounded-xl", className)}
      style={{
        left: isDrag ? destinationLeft : Math.round(startRect.left),
        top: isDrag ? destinationTop : Math.round(startRect.top),
        width: isDrag ? destinationWidth : Math.round(startRect.width),
        height: isDrag ? destinationHeight : Math.round(startRect.height),
      }}
      initial={
        isDrag
          ? false
          : visual.flyover
            ? {
                left: Math.round(startRect.left),
                top: Math.round(startRect.top),
                width: Math.round(startRect.width),
                height: Math.round(startRect.height),
              }
            : { left: releaseLeft, top: releaseTop, width: releaseWidth, height: releaseHeight }
      }
      animate={
        isDrag
          ? false
          : {
              left: destinationLeft,
              top: destinationTop,
              width: destinationWidth,
              height: destinationHeight,
            }
      }
      transition={
        isDrag
          ? { duration: 0 }
          : visual.flyover
            ? { duration: DOUBLE_CLICK_FLYOVER_MS / 1000, ease: [0.22, 1, 0.36, 1] }
            : visual.releasing
              ? { duration: MAGNET_RELEASE_EASE_MS / 1000, ease: [0.22, 1, 0.36, 1] }
              : { type: "spring", stiffness: 1000, damping: 50, mass: 0.15 }
      }
      onAnimationComplete={() => {
        if (isDrag) return;
        if (visual.settling || (completeOnFlyover && visual.flyover)) {
          onComplete();
        }
      }}
    >
      {children}
    </motion.div>,
    document.body,
  );
}
