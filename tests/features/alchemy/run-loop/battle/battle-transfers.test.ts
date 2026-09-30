import "../../../../helpers/mock-audio";
import { describe, expect, it, vi } from "vitest";
import { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfers";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { CardTransfer } from "@/features/alchemy/shared/types";
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
});
