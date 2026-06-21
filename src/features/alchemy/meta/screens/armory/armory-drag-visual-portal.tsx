import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { DOUBLE_CLICK_FLYOVER_MS, MAGNET_RELEASE_EASE_MS } from "./drag-constants";
import type { DragRect } from "./use-board-drag";

export type DragVisualBase = {
  source: DragRect;
  rect: DragRect;
  releaseRect?: DragRect | undefined;
  settling?: boolean | undefined;
  releasing?: boolean | undefined;
  flyover?: boolean | undefined;
};

export function DragVisualPortal({
  visual,
  testId = "armory-gear-drag-visual",
  completeOnFlyover = false,
  children,
  onComplete,
}: {
  visual: DragVisualBase;
  testId?: string;
  completeOnFlyover?: boolean;
  children: ReactNode;
  onComplete: () => void;
}) {
  const isDrag = !visual.settling && !visual.releasing && !visual.flyover;
  const startRect = visual.source;
  const dx = visual.rect.left - startRect.left;
  const dy = visual.rect.top - startRect.top;

  return createPortal(
    <motion.div
      data-testid={testId}
      className="pointer-events-none fixed z-[120] overflow-hidden rounded-xl"
      style={{
        left: startRect.left,
        top: startRect.top,
        width: startRect.width,
        height: startRect.height,
        willChange: "transform",
      }}
      initial={isDrag ? { x: dx, y: dy } : { x: 0, y: 0 }}
      animate={{ x: dx, y: dy }}
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
