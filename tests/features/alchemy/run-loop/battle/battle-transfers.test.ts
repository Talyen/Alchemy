import { createCleanup } from "@/lib/cleanup";
import "../../../../helpers/mock-audio";

import { describe, expect, it, vi } from "vitest";
import { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfers";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { CardTransfer } from "@/features/alchemy/shared/types";
import type { TimerClock } from "@/lib/animation/game-timer";
import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import { makeTestCardWithId } from "../../../../fixtures/battle";
import { playBattleEvent } from "@/lib/audio";

function makeTransfers(respectGeneration = true, clock?: TimerClock) {
  const playback = new PlaybackLifetime(clock);
  let transfers: CardTransfer[] = [];
  const presentation = {
    setCardTransfers: (update: (current: CardTransfer[]) => CardTransfer[]) => {
      transfers = update(transfers);
    },
    setHiddenHandCardKeys: vi.fn(),
    setCardTransferInProgress: vi.fn(),
  };
  const ctx = {
    battle: { read: () => ({ hasActiveBattle: true }) },
    playback,
    getPresentation: () => presentation,
    battleSceneRef: { current: null },
    drawPileRef: { current: null },
    discardPileRef: { current: null },
    handCardRefs: { current: {} },
    measureElementRect: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    measureVisualCardRect: () => ({ x: 0, y: 0, width: 100, height: 100 }),
  } as unknown as BattleControllerContext;
  return {
    playback,
    presentation,
    readTransfers: () => transfers,
    ...createBattleTransferDeps(ctx, (id) => !respectGeneration || playback.isCurrent(id)),
  };
}

describe("battle transfer lifetime wiring", () => {
  it.each([true, false])(
    "revokes abandoned discard UI and scheduling authority (caller checks generation: %s)",
    async (respectGeneration) => {
      vi.useFakeTimers();
      using _scopeCleanup = createCleanup(() => vi.useRealTimers());

      const transfers = makeTransfers(respectGeneration);
      const cards = [makeTestCardWithId("slash", { uid: 1 }), makeTestCardWithId("block", { uid: 2 })];
      const abandoned = transfers.animateDiscardedHand(cards, transfers.playback.id);
      expect(transfers.readTransfers()).toHaveLength(1);
      transfers.playback.restart();
      const replacement = transfers.animateDiscardedHand([cards[0]!], transfers.playback.id);
      transfers.presentation.setCardTransferInProgress.mockClear();
      await Promise.resolve();
      expect(transfers.readTransfers()).toHaveLength(1);
      expect(transfers.playback.pendingTimers).toBe(1);
      expect(transfers.presentation.setCardTransferInProgress).not.toHaveBeenCalled();
      transfers.playback.cancel();
      await Promise.all([abandoned, replacement]);
      expect(transfers.readTransfers()).toEqual([]);
    },
  );

  it("sequences flights right to left and waits for the final landing", async () => {
    vi.useFakeTimers();
    using _scopeCleanup = createCleanup(() => vi.useRealTimers());
    const transfers = makeTransfers();
    let finished = false;
    const pending = transfers
      .animateDiscardedHand([makeTestCardWithId("slash", { uid: 1 }), makeTestCardWithId("block", { uid: 2 })], 0)
      .then(() => {
        finished = true;
      });
    expect(transfers.readTransfers().map((item) => item.card.id)).toEqual(["block"]);
    await vi.advanceTimersByTimeAsync(619);
    expect(transfers.readTransfers().map((item) => item.card.id)).toEqual(["block"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(transfers.readTransfers().map((item) => item.card.id)).toEqual(["slash"]);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(620);
    await pending;
    expect(transfers.readTransfers()).toEqual([]);
    expect(transfers.playback.pendingTimers).toBe(0);
  });

  it("cancels delayed transfer sounds with their originating battle", async () => {
    vi.useFakeTimers();
    vi.mocked(playBattleEvent).mockClear();
    using _scopeCleanup = createCleanup(() => vi.useRealTimers());

    const transfers = makeTransfers();
    const abandoned = transfers.animateDiscardedHand(
      [makeTestCardWithId("slash", { uid: 1 }), makeTestCardWithId("block", { uid: 2 })],
      transfers.playback.id,
    );
    expect(playBattleEvent).toHaveBeenCalledTimes(1);
    transfers.playback.restart();
    await abandoned;
    await vi.runAllTimersAsync();
    expect(playBattleEvent).toHaveBeenCalledTimes(1);
    expect(transfers.playback.pendingTimers).toBe(0);
  });

  it("revokes retained draw dependencies without exposing the replacement draw lease", async () => {
    const transfers = makeTransfers();
    const oldDeps = transfers.getDrawSequenceDeps(transfers.playback.id);
    transfers.playback.restart();
    const replacementId = transfers.playback.id;
    const release = transfers.playback.beginDraw(replacementId);
    oldDeps.setTransferInProgress(false);
    oldDeps.setHiddenHandCardKeys(() => []);
    const releaseStale = oldDeps.playback.beginDraw(replacementId);
    await expect(oldDeps.playback.waitForFrame(replacementId)).resolves.toBe(false);
    expect(transfers.playback.pendingDraws).toBe(1);
    expect(oldDeps.playback.pendingDraws).toBe(0);
    expect(transfers.presentation.setCardTransferInProgress).not.toHaveBeenCalled();
    expect(transfers.presentation.setHiddenHandCardKeys).not.toHaveBeenCalled();
    releaseStale();
    expect(transfers.playback.pendingDraws).toBe(1);
    release();
  });

  it("cancels a transfer and removes its timer without requiring a full battle reset", async () => {
    vi.useFakeTimers();
    using _scopeCleanup = createCleanup(() => vi.useRealTimers());

    const transfers = makeTransfers();
    const discarding = transfers.animateDiscardedHand([makeTestCardWithId("slash", { uid: 1 })], 0);
    expect(transfers.readTransfers()).toHaveLength(1);
    expect(transfers.playback.pendingTimers).toBe(1);
    transfers.playback.cancelTransfers();
    await discarding;
    expect(transfers.readTransfers()).toEqual([]);
    expect(transfers.playback.pendingTimers).toBe(0);
  });

  it("does not publish or schedule a transfer after synchronous cancellation", async () => {
    const transfers = makeTransfers();
    transfers.playback.cancel();
    await transfers.animateDiscardedHand([makeTestCardWithId("slash", { uid: 1 })], 0);
    expect(transfers.readTransfers()).toEqual([]);
    expect(transfers.playback.pendingTimers).toBe(0);
  });

  it("finishes a transfer at its existing duration and releases its overlay", async () => {
    vi.useFakeTimers();
    using _scopeCleanup = createCleanup(() => vi.useRealTimers());

    const transfers = makeTransfers();
    const discarding = transfers.animateDiscardedHand([makeTestCardWithId("slash", { uid: 1 })], 0);
    const transfer = transfers.readTransfers()[0]!;
    const duration = Math.round(transfer.duration * 1000) + CARD_TRANSFER_CONFIG.completionBufferMs;
    await vi.advanceTimersByTimeAsync(duration - 1);
    expect(transfers.readTransfers()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await discarding;
    expect(transfers.readTransfers()).toEqual([]);
    expect(transfers.playback.pendingTimers).toBe(0);
    transfers.playback.cancelTransfers();
    expect(transfers.readTransfers()).toEqual([]);
  });

  it("releases a published transfer if timer scheduling fails", async () => {
    const failure = new Error("timer unavailable");
    const transfers = makeTransfers(true, {
      setTimeout: () => {
        throw failure;
      },
      clearTimeout: () => {},
    });
    await expect(transfers.animateDiscardedHand([makeTestCardWithId("slash", { uid: 1 })], 0)).rejects.toBe(failure);
    expect(transfers.readTransfers()).toEqual([]);
    expect(transfers.playback.pendingTimers).toBe(0);
  });
});
