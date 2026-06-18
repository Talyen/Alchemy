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
  return createPortal(
    <motion.div
      data-testid={testId}
      className="pointer-events-none fixed z-[120] overflow-hidden rounded-xl"
      initial={
        visual.flyover
          ? {
              x: 0,
              y: 0,
              width: visual.source.width,
              height: visual.source.height,
              boxShadow: "0 0px 0px 0px rgba(0,0,0,0)",
            }
          : {
              boxShadow: "0 0px 0px 0px rgba(0,0,0,0)",
            }
      }
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
        scale: 1,
        rotate: 0,
        boxShadow:
          visual.settling || visual.flyover ? "0 0px 0px 0px rgba(0,0,0,0)" : "0 25px 50px -12px rgba(0,0,0,0.5)",
      }}
      transition={{
        boxShadow: { duration: 1, ease: "easeOut" },
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
    </motion.div>,
    document.body,
  );
}
