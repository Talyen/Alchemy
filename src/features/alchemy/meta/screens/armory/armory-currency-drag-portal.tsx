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
  const isDrag = !visual.settling && !visual.releasing && !visual.flyover;

  return createPortal(
    isDrag ? (
      <div
        data-testid="armory-currency-drag-visual"
        className="pointer-events-none fixed z-[120] overflow-hidden rounded-xl"
        style={{
          left: visual.rect.left,
          top: visual.rect.top,
          width: visual.rect.width,
          height: visual.rect.height,
        }}
      >
        <div className="relative h-full w-full">
          <img src={art} alt="" className="h-full w-full object-cover" />
          <span className="absolute top-1 left-1 text-xs font-bold leading-none text-stone-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {count}
          </span>
        </div>
      </div>
    ) : (
      <motion.div
        data-testid="armory-currency-drag-visual"
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
      </motion.div>
    ),
    document.body,
  );
}
