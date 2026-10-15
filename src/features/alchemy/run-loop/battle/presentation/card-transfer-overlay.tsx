import { memo, useRef } from "react";
import { motion, useAnimationFrame, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { cardSurfaceClass } from "@/features/alchemy/shared/config/layout";
import { useStore } from "zustand";
import type { BattlePresentationStore } from "../battle-presentation-store";
import type { BattleRefs, CardTransfer } from "../../../shared/types";
import { getCardTransferPose } from "./card-transfer-motion";
import { defaultMeasureVisualCardRect, getCardRotation } from "./scene-geometry";
import { BattleSceneArtwork } from "../../../shared/ui/battle-scene-artwork";

type TransferRefs = Pick<BattleRefs, "handCardRefs" | "battleSceneRef">;

const CardTransferOverlay = memo(function CardTransferOverlay({
  transfer,
  refs,
}: {
  transfer: CardTransfer;
  refs: TransferRefs;
}) {
  const reduced = useReducedMotionPreference();
  const elapsed = useRef(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(transfer.fromScale);
  const rotate = useMotionValue(transfer.fromRotation);
  useAnimationFrame((_, delta) => {
    elapsed.current += delta;
    let current = transfer;
    if (transfer.kind === "draw") {
      const element = refs.handCardRefs.current[transfer.handCardKey] ?? null;
      const target = defaultMeasureVisualCardRect(element, refs.battleSceneRef.current);
      if (target && target.width > 0) {
        current = {
          ...transfer,
          to: {
            x: target.x + target.width / 2 - transfer.from.width / 2,
            y: target.y + target.height / 2 - transfer.from.height / 2,
            width: transfer.from.width,
            height: transfer.from.height,
          },
          toScale: target.width / transfer.from.width,
          toRotation: getCardRotation(element) ?? transfer.toRotation,
        };
      }
    }
    // Follow the live slot even after arrival, until playback hands visibility over.
    const pose = getCardTransferPose(current, reduced ? 1 : elapsed.current / (transfer.duration * 1000));
    x.set(pose.x);
    y.set(pose.y);
    scale.set(pose.scale);
    rotate.set(pose.rotate);
  });
  return (
    <motion.div
      data-flying-card
      data-transfer-kind={transfer.kind}
      data-transfer-card-key={transfer.handCardKey}
      aria-hidden="true"
      className="pointer-events-none absolute z-[45] transform-gpu will-change-transform"
      initial={false}
      style={{
        left: transfer.from.x,
        top: transfer.from.y,
        width: transfer.from.width,
        height: transfer.from.height,
        x,
        y,
        scale,
        rotate,
      }}
    >
      <BattleSceneArtwork className="battle-scene-piece h-full w-full rounded-shell-hero">
        <img
          src={transfer.card.art}
          alt=""
          draggable={false}
          decoding="async"
          className={cn("h-full w-full border border-border/80 object-cover", cardSurfaceClass)}
        />
      </BattleSceneArtwork>
    </motion.div>
  );
});

export function CardTransferLayer({
  presentation,
  refs,
}: {
  presentation: BattlePresentationStore;
  refs: TransferRefs;
}) {
  const cardTransfers = useStore(presentation, (s) => s.cardTransfers);
  return (
    <>
      {cardTransfers.map((transfer) => (
        <CardTransferOverlay key={transfer.id} transfer={transfer} refs={refs} />
      ))}
    </>
  );
}
