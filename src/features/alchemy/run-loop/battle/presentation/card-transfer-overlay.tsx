import { memo, useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { DISCARD_PILE_TOP_CARD_BOUNDS } from "@/lib/game-constants";
import { pileDiscardArt } from "@/features/alchemy/shared/config/game-data-catalog";
import { cardBack } from "@/lib/game-data";
import { cardSurfaceClass } from "@/features/alchemy/shared/config/layout";
import { useBattlePresentationStore } from "../battle-presentation-store";
import type { CardTransfer } from "../../../shared/types";
import { getCardTransferPose } from "./card-transfer-motion";

const TRANSFER_CARD_IMAGE_CLASS = "h-full w-full border border-border/80 object-cover";

const CardTransferOverlay = memo(function CardTransferOverlay({ transfer }: { transfer: CardTransfer }) {
  const reduced = useReducedMotionPreference();
  const progress = useMotionValue(reduced ? 1 : 0);
  const pose = useTransform(progress, (time) => getCardTransferPose(transfer, time));
  const x = useTransform(pose, (value) => value.x);
  const y = useTransform(pose, (value) => value.y);
  const scaleX = useTransform(pose, (value) => value.scaleX);
  const scaleY = useTransform(pose, (value) => value.scaleY);
  const rotate = useTransform(pose, (value) => value.rotate);
  const rotateY = useTransform(pose, (value) => value.rotateY);
  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    // Animate one clock, then derive the entire pose at the display's frame rate.
    const playback = animate(progress, 1, { duration: transfer.duration, ease: "linear" });
    return () => playback.stop();
  }, [progress, reduced, transfer.duration]);
  return (
    <motion.div
      data-flying-card
      data-transfer-kind={transfer.kind}
      className="pointer-events-none absolute z-[90] transform-gpu will-change-transform [backface-visibility:visible]"
      initial={false}
      style={{
        left: transfer.from.x,
        top: transfer.from.y,
        width: transfer.from.width,
        height: transfer.from.height,
        transformStyle: "preserve-3d",
        x,
        y,
        scaleX,
        scaleY,
        rotate,
        rotateY,
      }}
    >
      <div className="card-face absolute inset-0">
        <img
          src={transfer.card.art}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(TRANSFER_CARD_IMAGE_CLASS, cardSurfaceClass)}
        />
      </div>
      <div className="card-face-back absolute inset-0">
        {transfer.kind === "discard" ? (
          <DiscardCardBack />
        ) : (
          <img
            src={cardBack}
            alt=""
            draggable={false}
            decoding="async"
            className={cn(TRANSFER_CARD_IMAGE_CLASS, cardSurfaceClass)}
          />
        )}
      </div>
    </motion.div>
  );
});

function DiscardCardBack() {
  const crop = DISCARD_PILE_TOP_CARD_BOUNDS;
  return (
    <div data-discard-card-back className="relative h-full w-full overflow-hidden">
      <img
        src={pileDiscardArt}
        alt=""
        draggable={false}
        decoding="async"
        className="absolute max-w-none"
        style={{
          width: `${100 / crop.width}%`,
          height: `${100 / crop.height}%`,
          left: `${(-100 * crop.x) / crop.width}%`,
          top: `${(-100 * crop.y) / crop.height}%`,
        }}
      />
    </div>
  );
}

export function CardTransferLayer() {
  const cardTransfers = useBattlePresentationStore((s) => s.cardTransfers);
  return (
    <>
      {cardTransfers.map((transfer) => (
        <CardTransferOverlay key={transfer.id} transfer={transfer} />
      ))}
    </>
  );
}
