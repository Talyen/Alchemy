import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { DOUBLE_CLICK_FLYOVER_MS, MAGNET_RELEASE_EASE_MS, type GearDragVisual } from "./use-armory-gear-drag";

export function GearDragVisualPortal({
  visual,
  art,
  testId = "armory-gear-drag-visual",
  onComplete,
}: {
  visual: GearDragVisual;
  art: string;
  testId?: string;
  onComplete: () => void;
}) {
  const isDrag = !visual.settling && !visual.releasing && !visual.flyover;

  return createPortal(
    isDrag ? (
      <div
        data-testid={testId}
        className="pointer-events-none fixed z-[120] overflow-hidden rounded-xl"
        style={{
          left: visual.rect.left,
          top: visual.rect.top,
          width: visual.rect.width,
          height: visual.rect.height,
        }}
      >
        <img src={art} alt="" className="h-full w-full object-cover" />
      </div>
    ) : (
      <motion.div
        data-testid={testId}
        className="pointer-events-none fixed z-[120] overflow-hidden rounded-xl"
        initial={{
          x: 0,
          y: 0,
          width: visual.source.width,
          height: visual.source.height,
        }}
        style={{
          left: visual.source.left,
          top: visual.source.top,
          width: visual.source.width,
          height: visual.source.height,
          willChange: "transform,width,height",
        }}
        animate={{
          x: visual.rect.left - visual.source.left,
          y: visual.rect.top - visual.source.top,
          width: visual.rect.width,
          height: visual.rect.height,
        }}
        transition={{
          default: visual.flyover
            ? { duration: DOUBLE_CLICK_FLYOVER_MS / 1000, ease: [0.22, 1, 0.36, 1] }
            : visual.releasing
              ? { duration: MAGNET_RELEASE_EASE_MS / 1000, ease: [0.22, 1, 0.36, 1] }
              : visual.settling
                ? { type: "spring", stiffness: 1000, damping: 50, mass: 0.15 }
                : { type: "spring", stiffness: 1000, damping: 50, mass: 0.15 },
        }}
        onAnimationComplete={() => {
          if (visual.settling || visual.flyover) {
            onComplete();
          }
        }}
      >
        <img src={art} alt="" className="h-full w-full object-cover" />
      </motion.div>
    ),
    document.body,
  );
}
