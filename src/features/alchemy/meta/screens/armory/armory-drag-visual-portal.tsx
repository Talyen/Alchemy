import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { DOUBLE_CLICK_FLYOVER_MS, MAGNET_RELEASE_EASE_MS } from "./drag-constants";
import type { DragRect } from "./drag-types";

export interface DragVisualBase {
  source: DragRect;
  rect: DragRect;
  releaseRect?: DragRect | undefined;
  settling?: boolean | undefined;
  releasing?: boolean | undefined;
  flyover?: boolean | undefined;
}

function computeDragTransition(visual: DragVisualBase): Record<string, unknown> {
  if (!visual.settling && !visual.releasing && !visual.flyover) return { duration: 0 };
  if (visual.flyover) return { duration: DOUBLE_CLICK_FLYOVER_MS / 1000, ease: [0.22, 1, 0.36, 1] };
  if (visual.releasing) return { duration: MAGNET_RELEASE_EASE_MS / 1000, ease: [0.22, 1, 0.36, 1] };
  return { type: "spring", stiffness: 1000, damping: 50, mass: 0.15 };
}

function computeTransformOrigin(
  visual: DragVisualBase,
  startRect: DragRect,
  release: { left: number; top: number },
): { x: number; y: number } | boolean {
  if (!visual.settling && !visual.releasing && !visual.flyover) return false;
  const origin = visual.flyover ? { left: startRect.left, top: startRect.top } : release;
  return { x: origin.left, y: origin.top };
}

function buildDragPortalMotionProps(visual: DragVisualBase, completeOnFlyover: boolean) {
  const isDrag = !visual.settling && !visual.releasing && !visual.flyover;
  const startRect = visual.source;
  const release = {
    left: visual.releaseRect?.left ?? visual.rect.left,
    top: visual.releaseRect?.top ?? visual.rect.top,
  };
  const dest = {
    left: visual.rect.left,
    top: visual.rect.top,
    width: Math.round(visual.rect.width),
    height: Math.round(visual.rect.height),
  };
  const arrow = visual.settling === true || (completeOnFlyover && visual.flyover === true);
  let initialTransform: { x: number; y: number } | false = false;
  if (!isDrag) {
    const origin = computeTransformOrigin(visual, startRect, release);
    initialTransform = typeof origin === "object" ? { x: origin.x - dest.left, y: origin.y - dest.top } : false;
  }
  return { isDrag, dest, arrow, initialTransform };
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
  const { isDrag, dest, arrow, initialTransform } = buildDragPortalMotionProps(visual, completeOnFlyover);
  return createPortal(
    <motion.div
      key={isDrag ? "drag" : "settle"}
      data-testid={testId}
      className={cn("pointer-events-none fixed z-[120] overflow-hidden rounded-xl will-change-transform", className)}
      style={{
        left: dest.left,
        top: dest.top,
        width: dest.width,
        height: dest.height,
        transform: "translate3d(0, 0, 0)",
      }}
      initial={isDrag ? false : initialTransform}
      animate={isDrag ? false : { x: 0, y: 0 }}
      transition={computeDragTransition(visual)}
      onAnimationComplete={() => {
        if (!isDrag && arrow) onComplete();
      }}
    >
      {children}
    </motion.div>,
    document.body,
  );
}
