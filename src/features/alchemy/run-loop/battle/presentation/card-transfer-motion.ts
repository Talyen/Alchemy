import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import type { CardTransfer } from "../../../shared/types";

export function getCardTransferPose(transfer: CardTransfer, time: number) {
  const t = Math.min(1, Math.max(0, time));
  const progress = transfer.kind === "draw" ? 1 - (1 - t) ** 3 : t * t * (3 - 2 * t);
  // The arc joins the direct path with no added vertical velocity at either end.
  const arcEnvelope = t === 0 || t === 1 ? 0 : Math.sin(Math.PI * progress) ** 2;
  const interpolate = (from: number, to: number) => (progress === 1 ? to : from + (to - from) * progress);
  return {
    x: (transfer.to.x - transfer.from.x) * progress,
    y:
      (transfer.to.y - transfer.from.y) * progress - arcEnvelope * transfer.from.height * CARD_TRANSFER_CONFIG.arcRatio,
    scale: interpolate(transfer.fromScale, transfer.toScale),
    rotate: interpolate(transfer.fromRotation, transfer.toRotation),
  };
}
