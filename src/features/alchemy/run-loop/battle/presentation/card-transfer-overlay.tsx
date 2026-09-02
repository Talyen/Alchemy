import { memo } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

import { cardBack } from "@/lib/game-data";
import { cardSurfaceClass } from "@/features/alchemy/shared/config";
import type { CardTransfer } from "../../../shared/types";

export const CardTransferOverlay = memo(function CardTransferOverlay({ transfer }: { transfer: CardTransfer }) {
  const deltaX = transfer.to.x - transfer.from.x;
  const deltaY = transfer.to.y - transfer.from.y;

  return (
    <motion.div
      data-flying-card
      className="pointer-events-none absolute z-[90] transform-gpu will-change-transform [backface-visibility:hidden]"
      initial={{ x: 0, y: 0, rotateY: transfer.rotateY[0]! }}
      style={{
        left: transfer.from.x,
        top: transfer.from.y,
        width: transfer.from.width,
        height: transfer.from.height,
        transformStyle: "preserve-3d",
        rotateY: transfer.rotateY[0]!,
      }}
      animate={{
        x: deltaX,
        y: deltaY,
        scale: [transfer.fromScale, transfer.toScale],
        rotate: [transfer.fromRotation, transfer.toRotation],
        rotateY: transfer.rotateY,
      }}
      transition={{
        x: { duration: transfer.duration, ease: [0.22, 1, 0.36, 1] },
        y: { duration: transfer.duration, ease: [0.22, 1, 0.36, 1] },
        scale: { duration: transfer.duration, ease: [0.22, 1, 0.36, 1] },
        rotate: { duration: transfer.duration, ease: [0.22, 1, 0.36, 1] },
        rotateY: { duration: transfer.duration, ease: "linear" },
      }}
    >
      <div className="card-face absolute inset-0">
        <img
          src={transfer.card.art}
          alt=""
          className={cn("h-full w-full border border-border/80 object-cover", cardSurfaceClass)}
        />
      </div>
      <div className="card-face-back absolute inset-0">
        <img
          src={cardBack}
          alt=""
          className={cn("h-full w-full border border-border/80 object-cover", cardSurfaceClass)}
        />
      </div>
    </motion.div>
  );
});
