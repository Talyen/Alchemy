// Flying card transfer overlay for exact draw-pile and discard-pile handoffs in Battle.
// Depends on motion, shared card surfaces, card-back art, and feature transfer geometry.
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

import { cardBack } from "@/lib/game-data";
import { cardSurfaceClass } from "@/features/alchemy/shared/config";
import type { CardTransfer } from "../../../shared/types";

export function CardTransferOverlay({ transfer }: { transfer: CardTransfer }) {
  return (
    <motion.div
      data-flying-card
      className="pointer-events-none absolute z-wish-overlay"
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
      <div className="card-face absolute inset-0">
        <img
          src={transfer.card.art}
          alt=""
          aria-hidden="true"
          className={cn("h-full w-full object-cover", cardSurfaceClass)}
        />
      </div>
      <div className="card-face-back absolute inset-0">
        <img src={cardBack} alt="" aria-hidden="true" className={cn("h-full w-full object-cover", cardSurfaceClass)} />
      </div>
    </motion.div>
  );
}
