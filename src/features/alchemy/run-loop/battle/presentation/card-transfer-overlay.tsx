import { memo, useMemo } from "react";
import { motion, useAnimationFrame, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { cardArtFrameClass, cardArtImageClass } from "@/features/alchemy/shared/config/layout";
import { useStore } from "zustand";
import type { BattlePresentationStore } from "../battle-presentation-store";
import type { BattleRefs, CardTransfer } from "../../../shared/types";
import { getCardTransferPose } from "./card-transfer-motion";
import { defaultMeasureVisualCardRect, getCardRotation } from "./scene-geometry";
import { BattleSceneArtwork } from "../../../shared/ui/battle-scene-artwork";
import { Surface } from "../../../shared/ui/surface";
import type { BattleSnapshot } from "@/lib/battle";
import { getPlayableHandCardKeys } from "../playable-hand";

type TransferRefs = Pick<BattleRefs, "handCardRefs" | "battleSceneRef">;

const CardTransferOverlay = memo(function CardTransferOverlay({
  transfer,
  refs,
  unplayable,
}: {
  transfer: CardTransfer;
  refs: TransferRefs;
  unplayable: boolean;
}) {
  const reduced = useReducedMotionPreference();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(transfer.fromScale);
  const rotate = useMotionValue(transfer.fromRotation);
  useAnimationFrame((elapsed) => {
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
    // Motion caps frame deltas at 40ms; elapsed time stays aligned with playback timers.
    const pose = getCardTransferPose(current, reduced ? 1 : elapsed / (transfer.duration * 1000));
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
      <Surface
        className={cn(
          cardArtFrameClass,
          "battle-scene-piece aspect-[3/4] h-full w-full",
          unplayable && "hand-card-unplayable",
        )}
      >
        <BattleSceneArtwork className="h-full w-full">
          <img
            src={transfer.card.art}
            alt=""
            draggable={false}
            decoding="async"
            className={cn("block h-full w-full", cardArtImageClass)}
          />
        </BattleSceneArtwork>
      </Surface>
    </motion.div>
  );
});

export function CardTransferLayer({
  presentation,
  refs,
  playabilityState,
}: {
  presentation: BattlePresentationStore;
  refs: TransferRefs;
  playabilityState: BattleSnapshot;
}) {
  const cardTransfers = useStore(presentation, (s) => s.cardTransfers);
  const playableHandCardKeys = useMemo(() => getPlayableHandCardKeys(playabilityState), [playabilityState]);
  return (
    <>
      {cardTransfers.map((transfer) => (
        <CardTransferOverlay
          key={transfer.id}
          transfer={transfer}
          refs={refs}
          unplayable={!playableHandCardKeys.has(transfer.handCardKey)}
        />
      ))}
    </>
  );
}
