import "../../../../helpers/mock-audio";
import { describe, expect, it, vi } from "vitest";
import { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfers";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { CardTransfer } from "@/features/alchemy/shared/types";
import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import { makeTestCardWithId } from "../../../../fixtures/battle";

function makeTransfers() {
  const playback = new PlaybackLifetime();
  let transfers: CardTransfer[] = [];
  const presentation = {
    setCardTransfers: (update: (current: CardTransfer[]) => CardTransfer[]) => {
      transfers = update(transfers);
    },
    setHiddenHandCardKeys: vi.fn(),
    setCardTransferInProgress: vi.fn(),
  };
  const ctx = {
    playback,
    getPresentation: () => presentation,
    battleSceneRef: { current: null },
    discardPileRef: { current: null },
    handCardRefs: { current: {} },
    measureElementRect: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    measureVisualCardRect: () => ({ x: 0, y: 0, width: 100, height: 100 }),
  } as unknown as BattleControllerContext;
  return { playback, readTransfers: () => transfers, ...createBattleTransferDeps(ctx, () => true) };
}

describe("battle transfer lifetime wiring", () => {
  it("cancels a transfer and removes its timer without requiring a full battle reset", async () => {
    vi.useFakeTimers();
    try {
      const transfers = makeTransfers();
      const discarding = transfers.animateDiscardedHand([makeTestCardWithId("slash", { uid: 1 })], 0);
      expect(transfers.readTransfers()).toHaveLength(1);
      expect(transfers.playback.timers.size).toBe(1);
      transfers.playback.cancelTransfers();
      await discarding;
      expect(transfers.readTransfers()).toEqual([]);
      expect(transfers.playback.timers.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not publish or schedule a transfer after synchronous cancellation", async () => {
    const transfers = makeTransfers();
    transfers.playback.cancel();
    await transfers.animateDiscardedHand([makeTestCardWithId("slash", { uid: 1 })], 0);
    expect(transfers.readTransfers()).toEqual([]);
    expect(transfers.playback.timers.size).toBe(0);
  });

  it("finishes a transfer at its existing duration and releases its overlay", async () => {
    vi.useFakeTimers();
    try {
      const transfers = makeTransfers();
      const discarding = transfers.animateDiscardedHand([makeTestCardWithId("slash", { uid: 1 })], 0);
      const transfer = transfers.readTransfers()[0]!;
      const duration = Math.round(transfer.duration * 1000) + CARD_TRANSFER_CONFIG.completionBufferMs;
      await vi.advanceTimersByTimeAsync(duration - 1);
      expect(transfers.readTransfers()).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      await discarding;
      expect(transfers.readTransfers()).toEqual([]);
      expect(transfers.playback.timers.size).toBe(0);
      transfers.playback.cancelTransfers();
      expect(transfers.readTransfers()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases a published transfer if timer scheduling fails", async () => {
    const transfers = makeTransfers();
    const failure = new Error("timer unavailable");
    vi.spyOn(transfers.playback.timers, "setGameTimeout").mockImplementation(() => {
      throw failure;
    });
    await expect(transfers.animateDiscardedHand([makeTestCardWithId("slash", { uid: 1 })], 0)).rejects.toBe(failure);
    expect(transfers.readTransfers()).toEqual([]);
    expect(transfers.playback.timers.size).toBe(0);
  });
});
