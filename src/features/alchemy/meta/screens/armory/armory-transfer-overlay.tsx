import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface TransferRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface FlyingItem {
  id: string;
  art: string;
  sourceRect: TransferRect;
  destRect?: TransferRect | null | undefined;
  isFadingOut?: boolean | undefined;
  isTrinket?: boolean | undefined;
}

export function ArmoryTransferOverlay({
  flyingItems,
  onComplete,
}: {
  flyingItems: readonly FlyingItem[];
  onComplete: () => void;
}) {
  const reducedMotion = useReducedMotion();

  // In reduced motion, skip travel and complete immediately
  useEffect(() => {
    if (reducedMotion && flyingItems.length > 0) {
      onComplete();
    }
  }, [reducedMotion, flyingItems.length, onComplete]);

  if (reducedMotion || flyingItems.length === 0 || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      data-testid="armory-transfer-overlay"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      {flyingItems.map((item, index) => {
        const hasValidDest = Boolean(item.destRect && item.destRect.width > 0 && item.destRect.height > 0);
        const dest = hasValidDest
          ? item.destRect!
          : {
              ...item.sourceRect,
              left: item.sourceRect.left + 120,
            };

        const isFadeOnly = (item.isFadingOut ?? false) || !hasValidDest;

        return (
          <motion.div
            key={item.id}
            initial={{
              position: "fixed",
              top: item.sourceRect.top,
              left: item.sourceRect.left,
              width: item.sourceRect.width,
              height: item.sourceRect.height,
              opacity: 1,
            }}
            animate={{
              top: dest.top,
              left: dest.left,
              width: dest.width,
              height: dest.height,
              opacity: isFadeOnly ? 0 : 1,
            }}
            transition={{
              duration: 0.22,
              ease: "easeOut",
            }}
            {...(index === 0 ? { onAnimationComplete: onComplete } : {})}
            className="fixed overflow-hidden rounded-shell-hero"
          >
            <img
              src={item.art}
              alt=""
              className={cn(
                "pointer-events-none h-full w-full object-cover",
                item.isTrinket ? "aspect-[3/4]" : "rounded-none",
              )}
            />
          </motion.div>
        );
      })}
    </div>,
    document.body,
  );
}
