import { describe, expect, it } from "vitest";
import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import { getCardTransferPose } from "@/features/alchemy/run-loop/battle/presentation/card-transfer-motion";
import type { CardTransfer } from "@/features/alchemy/shared/types";
import { makeTestCard } from "../../../../../fixtures/battle";

const transfer: CardTransfer = {
  id: "draw-1",
  kind: "draw",
  card: makeTestCard(),
  from: { x: 10, y: 100, width: 80, height: 120 },
  to: { x: 210, y: 130, width: 80, height: 120 },
  fromScale: 0.8,
  toScale: 1,
  fromRotation: 0,
  toRotation: 4.2,
  rotateY: [...CARD_TRANSFER_CONFIG.drawFlipKeyframes],
  duration: 0.5,
};

describe("standard card motion", () => {
  it("turns through the edge-on midpoint without stopping", () => {
    for (const kind of ["draw", "discard"] as const) {
      const rotateY = [
        ...(kind === "draw" ? CARD_TRANSFER_CONFIG.drawFlipKeyframes : CARD_TRANSFER_CONFIG.discardFlipKeyframes),
      ];
      const [start, end] = kind === "draw" ? CARD_TRANSFER_CONFIG.drawFlipTimes : CARD_TRANSFER_CONFIG.discardFlipTimes;
      const middle = (start + end) / 2;
      const before = getCardTransferPose({ ...transfer, kind, rotateY }, middle - 0.005).rotateY;
      const after = getCardTransferPose({ ...transfer, kind, rotateY }, middle + 0.005).rotateY;
      expect(Math.abs(after - before)).toBeGreaterThan(4);
      expect(getCardTransferPose({ ...transfer, kind, rotateY }, 1).rotateY).toBe(rotateY.at(-1));
    }
  });

  it("lands at exact width and height independently", () => {
    const pose = getCardTransferPose({ ...transfer, toScale: 0.4, toScaleY: 0.35, toRotation: 0 }, 1);
    expect(pose.x).toBe(200);
    expect(pose.y).toBe(30);
    expect(pose.scaleX).toBe(0.4);
    expect(pose.scaleY).toBe(0.35);
    expect(pose.rotate).toBe(0);
  });
});
