// Flying card transfer overlay for exact draw-pile and discard-pile handoffs in Battle.
// Depends on motion, shared card surfaces, card-back art, and feature transfer geometry.
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

import { cardBack } from "@/lib/game-data";
import { cardSurfaceClass } from "../../config";
import type { CardTransfer } from "../../types";

export function CardTransferOverlay({ transfer }: { transfer: CardTransfer }) {
  return (
    <motion.div
      data-flying-card
      className="pointer-events-none absolute z-[90]"
      initial={{ rotateY: transfer.rotateY[0] }}
      style={{
        left: transfer.from.x,
        top: transfer.from.y,
        width: transfer.from.width,
        height: transfer.from.height,
        transformStyle: "preserve-3d",
        rotateY: transfer.rotateY[0],
      }}
      animate={{
        left: transfer.to.x,
        top: transfer.to.y,
        scale: [transfer.fromScale, transfer.toScale],
        rotate: [transfer.fromRotation, transfer.toRotation],
        rotateY: transfer.rotateY,
      }}
      transition={{
        left: { duration: transfer.duration, ease: [0.22, 1, 0.36, 1] },
        top: { duration: transfer.duration, ease: [0.22, 1, 0.36, 1] },
        scale: { duration: transfer.duration, ease: [0.22, 1, 0.36, 1] },
        rotate: { duration: transfer.duration, ease: [0.22, 1, 0.36, 1] },
        rotateY: { duration: transfer.duration, ease: "linear" },
      }}
    >
      <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
        <img
          src={transfer.card.art}
          alt=""
          aria-hidden="true"
          className={cn("h-full w-full object-cover", cardSurfaceClass)}
        />
      </div>
      <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
        <img src={cardBack} alt="" aria-hidden="true" className={cn("h-full w-full object-cover", cardSurfaceClass)} />
      </div>
    </motion.div>
  );
}
