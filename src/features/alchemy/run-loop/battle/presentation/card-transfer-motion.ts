import { easeInOut } from "motion";
import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import type { CardTransfer } from "../../../shared/types";

export function getCardTransferPose(transfer: CardTransfer, time: number) {
  const t = Math.min(1, Math.max(0, time));
  const progress = 1 - (1 - t) ** 3;
  // The squared sine joins the direct path with zero added vertical velocity
  // at both ends, avoiding a sudden lift or last-moment change of direction.
  const arcEnvelope = t === 0 || t === 1 ? 0 : Math.sin(Math.PI * progress) ** 2;
  const interpolate = (from: number, to: number, p: number) => (p === 1 ? to : from + (to - from) * p);
  const [flipStart, flipEnd] =
    transfer.kind === "draw" ? CARD_TRANSFER_CONFIG.drawFlipTimes : CARD_TRANSFER_CONFIG.discardFlipTimes;
  const flipProgress = Math.min(1, Math.max(0, (t - flipStart) / (flipEnd - flipStart)));
  return {
    x: (transfer.to.x - transfer.from.x) * progress,
    y:
      (transfer.to.y - transfer.from.y) * progress - arcEnvelope * transfer.from.height * CARD_TRANSFER_CONFIG.arcRatio,
    scaleX: interpolate(transfer.fromScale, transfer.toScale, progress),
    scaleY: interpolate(transfer.fromScale, transfer.toScaleY ?? transfer.toScale, progress),
    rotate: interpolate(transfer.fromRotation, transfer.toRotation, progress),
    // One uninterrupted half-turn avoids the old stop at the edge-on midpoint.
    rotateY: interpolate(transfer.rotateY[0] ?? 0, transfer.rotateY.at(-1) ?? 0, easeInOut(flipProgress)),
  };
}
