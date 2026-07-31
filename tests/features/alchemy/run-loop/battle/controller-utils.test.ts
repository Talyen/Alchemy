import { describe, expect, it } from "vitest";
import {
  centeredRectForSize,
  getCardKey,
  getCardTransferBatchSpeed,
} from "@/features/alchemy/run-loop/battle/controller-utils";
import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import { makeTestCardWithId } from "../../../../fixtures/battle";

describe("getCardTransferBatchSpeed", () => {
  it("uses small, medium, and large multipliers by hand size", () => {
    const { batchSpeedMultipliers } = CARD_TRANSFER_CONFIG;
    expect(getCardTransferBatchSpeed(1)).toBe(batchSpeedMultipliers.small);
    expect(getCardTransferBatchSpeed(batchSpeedMultipliers.mediumCardCount)).toBe(batchSpeedMultipliers.medium);
    expect(getCardTransferBatchSpeed(6)).toBe(batchSpeedMultipliers.large);
  });
});

describe("getCardKey", () => {
  it("combines card id and uid", () => {
    expect(getCardKey(makeTestCardWithId("block", { uid: 7 }))).toBe("block-7");
  });
});

describe("centeredRectForSize", () => {
  it("centers a target size on the source rect", () => {
    const centered = centeredRectForSize({ x: 10, y: 20, width: 100, height: 50 }, 40, 20);
    expect(centered).toEqual({ x: 40, y: 35, width: 40, height: 20 });
  });
});
