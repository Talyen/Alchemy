import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { MAGNET_RELEASE_EASE_MS } from "./use-armory-gear-drag";
import type { CurrencyDragVisual } from "./use-armory-currency-drag";

export function CurrencyDragVisualPortal({
  visual,
  art,
  count,
  onComplete,
}: {
  visual: CurrencyDragVisual;
  art: string;
  count: number;
  onComplete: () => void;
}) {
  return createPortal(
    <motion.div
      data-testid="armory-currency-drag-visual"
      className="pointer-events-none fixed z-[120] overflow-hidden rounded-xl"
      initial={{ boxShadow: "0 0px 0px 0px rgba(0,0,0,0)" }}
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
        boxShadow: visual.settling ? "0 0px 0px 0px rgba(0,0,0,0)" : "0 25px 50px -12px rgba(0,0,0,0.5)",
      }}
      transition={{
        boxShadow: { duration: 1, ease: "easeOut" },
        default: visual.releasing
          ? { duration: MAGNET_RELEASE_EASE_MS / 1000, ease: [0.22, 1, 0.36, 1] }
          : visual.settling
            ? { type: "spring", stiffness: 1000, damping: 50, mass: 0.15 }
            : { type: "spring", stiffness: 1000, damping: 50, mass: 0.15 },
      }}
      onAnimationComplete={() => {
        if (visual.settling) onComplete();
      }}
    >
      <div className="relative h-full w-full">
        <img src={art} alt="" className="h-full w-full object-cover" />
        <span className="absolute top-1 left-1 text-xs font-bold leading-none text-stone-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {count}
        </span>
      </div>
    </motion.div>,
    document.body,
  );
}
