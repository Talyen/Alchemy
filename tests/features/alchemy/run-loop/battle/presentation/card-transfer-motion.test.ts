import { describe, expect, it } from "vitest";
import { getCardTransferPose } from "@/features/alchemy/run-loop/battle/presentation/card-transfer-motion";
import type { CardTransfer } from "@/features/alchemy/shared/types";
import { makeTestCard } from "../../../../../fixtures/battle";

const transfer: CardTransfer = {
  id: "draw-1",
  kind: "draw",
  card: makeTestCard(),
  handCardKey: "slash-1",
  from: { x: 10, y: 500, width: 80, height: 120 },
  to: { x: 210, y: 130, width: 80, height: 120 },
  fromScale: 0.94,
  toScale: 1,
  fromRotation: -47.8,
  toRotation: 4.2,
  duration: 0.5,
  rotateY: [180, 0],
};

describe("corner-pile card motion", () => {
  it.each(["draw", "discard"] as const)("rotates %s continuously clockwise and lands exactly", (kind) => {
    let previous = transfer.fromRotation;
    for (let sample = 0; sample <= 60; sample++) {
      const pose = getCardTransferPose({ ...transfer, kind }, sample / 60);
      expect(pose.rotate).toBeGreaterThanOrEqual(previous);
      expect(pose.scaleX).toBeGreaterThanOrEqual(0.94);
      expect(pose.scaleX).toBeLessThanOrEqual(1);
      previous = pose.rotate;
    }
    expect(getCardTransferPose({ ...transfer, kind }, 1)).toEqual({
      x: 200,
      y: -370,
      scaleX: 1,
      scaleY: 1,
      rotate: 4.2,
      rotateY: 0,
    });
  });
});
